"""
Object representing a batch operation, consisting of
one or more OcrTasks.
"""

import datetime
from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField

from ocradmin.projects.models import Project


class Batch(models.Model):
    """
    OCR Batch object.
    """
    user = models.ForeignKey(User, related_name="batches")
    name = models.CharField(max_length=255)
    project = models.ForeignKey(Project, related_name="batches")
    script = models.TextField()
    task_type = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    tags = TagField()
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)

    def __unicode__(self):
        """
        Unicode representation.
        """
        return self.name

    def save(self):
        """
        Override save to add timestamps.
        """
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(Batch, self).save()

    def username(self):
        return self.user.username

    def subtasks(self):
        """
        Alias for 'tasks', for use when serializing
        """
        return self.tasks.all()

    def is_complete(self):
        """
        Check whether all tasks are done.
        """
        numrunning = self.tasks.exclude(
                status__in=("SUCCESS", "FAILURE", "ABORTED")).count()
        return numrunning == 0

    def task_count(self):
        """
        Return the number of contained tasks.
        """
        return self.tasks.count()

    def estimate_progress(self):
        """
        Aggregated percentage of how many tasks
        are complete.  This is going to be a bit
        of an estimate and does not take account
        of stages where progress is difficult to
        measure, i.e. segmentation.
        """
        totallines = 0
        percentdone = 0
        runningtasks = 0
        tasks = self.tasks.all()
        for t in tasks:
            totallines += t.lines or 50
        if totallines == 0:
            return 0
        for t in tasks:
            lines = t.lines or 50
            weight = float(lines) / float(totallines)
            if t.status in ("FAILURE", "ABORTED", "SUCCESS"):
                percentdone += (weight * 100)
            else:
                runningtasks += 1
                percentdone += (weight * t.progress)
        done = min(100.0, percentdone)
        # if there are running tasks, never go above
        # 99%
        if runningtasks > 0:
            done -= 1.0
        return max(0, done)

    def errored_tasks(self):
        """
        Get all errored tasks.
        """
        return self.tasks.filter(status="FAILURE")

    def inspection_url(self):
        """
        URL for viewing results
        """
        if self.task_type == "compare.groundtruth":
            return "/training/comparison/%d/" % self.pk
        elif self.task_type == "fedora.ingest":
            return "#"
        else:
            return "/batch/transcript/%d/" % self.pk

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/batch/show/%d/" % self.pk

    def get_delete_url(self):
        """url to update an object detail"""
        return "/batch/delete/%d/" % self.pk

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/batch/list/"


