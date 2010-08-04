from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField


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
    name = models.CharField(max_length=255)
    task_type = models.CharField(max_length=100)
    batch_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField(blank=True, null=True)
    tags = TagField()
    created_on = models.DateTimeField(auto_now_add=True, editable=False)


