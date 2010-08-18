from django.db import models
from picklefield import fields

from ocradmin.batch.models import OcrBatch
from django.contrib.auth.models import User


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
        ("ERROR", "Error"),
    )

    user = models.ForeignKey(User)
    batch = models.ForeignKey(OcrBatch, related_name="tasks", blank=True, null=True)
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
    updated_on = models.DateTimeField(auto_now_add=True, auto_now=True, editable=False)


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

