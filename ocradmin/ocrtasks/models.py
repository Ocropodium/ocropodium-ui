"""
Class for Asyncronous OCR jobs.  Wraps tasks that run on the Celery
queue with more metadata and persistance.
"""

import datetime
import uuid
from django.db import models
from picklefield import fields

from ocradmin.batch.models import Batch
from ocradmin.projects.models import Project

from django.contrib.auth.models import User
import celery
from celery.contrib.abortable import AbortableAsyncResult


class OcrTask(models.Model):
    """
    OCR Task object.
    """
    STATUS_CHOICES = (
        ("INIT", "Initialising"),
        ("PENDING", "Pending"),
        ("STARTED", "Started"),
        ("RETRY", "Retry"),
        ("SUCCESS", "Success"),
        ("FAILURE", "Failure"),
    )

    user = models.ForeignKey(User)
    batch = models.ForeignKey(Batch,
            related_name="tasks", blank=True, null=True)
    project = models.ForeignKey(Project,
            related_name="tasks", blank=True, null=True)
    task_id = models.CharField(max_length=100)
    task_name = models.CharField(max_length=100)
    page_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    lines = models.IntegerField(blank=True, null=True)
    progress = models.FloatField(default=0.0, blank=True, null=True)
    args = fields.PickledObjectField(blank=True, null=True)
    kwargs = fields.PickledObjectField(blank=True, null=True)
    error = fields.PickledObjectField(blank=True, null=True)
    traceback = models.TextField(blank=True, null=True)
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(OcrTask, self).save()

    def abort(self):
        """
        Abort a task.
        """
        if not self.is_active():
            return
        asyncres = AbortableAsyncResult(self.task_id)
        if self.is_abortable():
            asyncres.abort()
            if asyncres.is_aborted():
                self.status = "ABORTED"
                self.save()
        celery.task.control.revoke(self.task_id,
                terminate=True, signal="SIGTERM")

    def run(self, task_name=None, asyncronous=True, untracked=False, **kwargs):
        """
        Run the task in a blocking manner and return 
        the sync object.
        """
        tname = task_name if task_name is not None else self.task_name
        if untracked:
            tname = "_%s" % tname
        celerytask = celery.registry.tasks[tname]
        func = celerytask.apply_async if asyncronous else celerytask.apply
        kwds = self.kwargs
        kwds.update(kwargs)
        return func(args=self.args, **kwds)

    def retry(self):
        """
        Retry the Celery job.
        """
        if self.is_abortable():
            self.abort()
        self.task_id = self.get_new_task_id()
        self.status = "RETRY"
        self.progress = 0
        self.save()
        self.kwargs["task_id"] = self.task_id
        celerytask = celery.registry.tasks[self.task_name]
        celerytask.apply_async(args=self.args, **self.kwargs)

    def latest_transcript(self):
        """
        Return the latest transcript.
        """
        try:
            result = self.transcripts.order_by("-version")[0].data
        except IndexError:
            result = None
        return result

    def is_batch_task(self):
        """
        Whether task is part of a batch.
        """
        return self.batch is None

    def is_revokable(self):
        """
        Whether or not a given status allows
        revoking (cancelling) a task.
        """
        return self.status in ("INIT", "PENDING")

    def is_abortable(self):
        """
        Whether we can cancel execution.
        """
        return self.status in ("STARTED", "RETRY")

    def is_active(self):
        """
        The task is running or awaiting running.
        """
        return self.status in ("INIT", "PENDING", "RETRY", "STARTED")


    @classmethod
    def run_celery_task(cls, taskname, args, taskkwargs={}, **kwargs):
        """
        Run an arbitary Celery task.
        """
        if kwargs.get("untracked", False):
            taskname = "_%s" % taskname
        task = celery.registry.tasks[taskname]
        func = task.apply_async if kwargs.get("asyncronous", False) \
                else task.apply
        return func(args=args, kwargs=taskkwargs, **kwargs)

    @classmethod
    def run_celery_task_multiple(cls, taskname, tasks, **kwargs):
        """
        Optimised method for running multiple Celery tasks
        (uses the same celery publisher.)
        """
        if len(tasks) == 0:
            return []        
        celerytask = celery.registry.tasks[taskname]
        publisher = celerytask.get_publisher(connect_timeout=5)
        func = celerytask.apply_async if kwargs.get("asyncronous", True) \
                else celerytask.apply
        results = []
        try:
            for task in tasks:
                results.append(func(args=task.args, kwargs=task.kwargs,
                        publisher=publisher, task_id=task.task_id, **kwargs))
        finally:
            publisher.close()
            publisher.connection.close()
        return results

    @classmethod
    def revoke_celery_task(cls, task_id, kill=True):
        """
        Kill a Celery task.
        """
        celery.task.control.revoke(task_id, terminate=kill, signal="SIGTERM")

    @classmethod
    def get_celery_result(cls, task_id):
        """
        Proxy for fetching Celery results.
        """
        return celery.result.AsyncResult(task_id)

    @classmethod
    def get_new_task_id(cls):
        """
        Get a unique id for a new page task, given it's
        file path.
        """
        return str(uuid.uuid1())

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/ocrtasks/detail/%d/" % self.pk

    def get_delete_url(self):
        """url to update an object detail"""
        return "/ocrtasks/delete/%d/" % self.pk

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/ocrtasks/list/"


