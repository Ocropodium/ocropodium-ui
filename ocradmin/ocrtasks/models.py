"""
Class for Asyncronous OCR jobs.  Wraps tasks that run on the Celery
queue with more metadata and persistance.
"""

import uuid
from django.db import models
from picklefield import fields

from ocradmin.batch.models import OcrBatch
from ocradmin.projects.models import OcrProject

from django.contrib.auth.models import User
import celery


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
    batch = models.ForeignKey(OcrBatch,
            related_name="tasks", blank=True, null=True)
    project = models.ForeignKey(OcrProject,
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
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    updated_on = models.DateTimeField(
            auto_now_add=True, auto_now=True, editable=False)


    def abort(self):
        """
        Abort a task.
        """
        if not self.is_active():
            return
        asyncres = AbortableAsyncResult(self.task_id)
        asyncres.revoke()
        if asyncres.is_abortable():
            asyncres.abort()
            if asyncres.is_aborted():
                self.status = "ABORTED"
                self.save()

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
    def run_celery_task(cls, *args, **kwargs):
        """
        Run an arbitary Celery task.
        """
        tname = kwargs.get("task_name")
        if kwargs.get("untracked", False):
            tname = "_%s" % tname
        task = celery.registry.tasks[tname]
        func = task.apply_async if kwargs.get("asyncronous", False) \
                else task.apply
        return func(args=args, **kwargs)

    @classmethod
    def run_multiple(cls, task_name, tasks, **kwargs):
        """
        Run multiple tasks efficiently, using the same
        celery publisher.
        """
        if len(tasks) == 0:
            return []        
        celerytask = celery.registry.tasks[task_name]
        publisher = celerytask.get_publisher(connect_timeout=5)
        func = celerytask.apply_async if kwargs.get("asyncronous", True) \
                else celerytask.apply
        results = []
        try:
            for task in tasks:
                results.append(func(args=task.args,
                        publisher=publisher, **task.kwargs))
        finally:
            publisher.close()
            publisher.connection.close()
        return results

    @classmethod
    def get_new_task_id(cls):
        """
        Get a unique id for a new page task, given it's
        file path.
        """
        return str(uuid.uuid1())



class Transcript(models.Model):
    """
    Results set for a task.
    """
    task = models.ForeignKey(OcrTask, related_name="transcripts")
    version = models.IntegerField(default=0, editable=False)
    data = fields.PickledObjectField()
    is_retry = models.BooleanField(default=False, editable=False)
    is_final = models.BooleanField(default=False)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)


    def save(self, force_insert=False, force_update=False):
        """
        Override save method to create the version number automatically.
        """
        if self.version == 0:
            # increment version number
            try:
                recent = Transcript.objects.filter(
                        task__exact=self.task).order_by("-version")[0]
                self.version = recent.version + 1
            except IndexError:
                self.version = 1
        # if final, set other transcripts for the same task to not final
        if self.is_final:
            others = Transcript.objects.filter(
                    task__exact=self.task).exclude(
                            version=self.version).update(is_final=False)
        # Call the "real" save() method
        super(Transcript, self).save(force_insert, force_update)

