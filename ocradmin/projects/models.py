import os
from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField

from ocradmin.core import utils as ocrutils


class OcrProject(models.Model):
    """
    OCR Project model.
    """
    user = models.ForeignKey(User)
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    tags = TagField()
    created_on = models.DateTimeField(auto_now_add=True, editable=False)

    def __unicode__(self):
        """
        String representation.
        """
        return self.name

