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
        ("RUNNING", "Running"),
        ("RETRY", "Retry"),
        ("SUCCESS", "Success"),
        ("ERROR", "Error"),
        ("DONE", "Done"),
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
        return self.status in ("RUNNING", "RETRY")


