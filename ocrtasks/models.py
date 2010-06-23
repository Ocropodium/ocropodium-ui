from django.db import models
from picklefield import fields
from django.contrib.auth.models import User


class OcrBatch(models.Model):
    """
    OCR Batch object.
    """
    TYPE_CHOICES = (
        ("ONESHOT", "One-Shot"),
        ("BATCH", "Batch"),
        ("TEST", "Test"),
    )

    user = models.ForeignKey(User)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)


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

    batch = models.ForeignKey(OcrBatch)
    task_id = models.CharField(max_length=100)
    page = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    args = fields.PickledObjectField(blank=True, null=True)
    kwargs = fields.PickledObjectField(blank=True, null=True)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    updated_on = models.DateTimeField(auto_now_add=True, auto_now=True, editable=False)

    @property
    def user(self):
        return self.batch.user
