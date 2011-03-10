"""
A Reference Page is an OCR object that consists of a source
image, a binarized image, and a transcript of lines relating
to the latter.
"""

import os
from picklefield import fields
from django.db import models
from django.contrib.auth.models import User
from ocradmin.projects.models import OcrProject
from ocradmin.core import utils as ocrutils




class ReferencePage(models.Model):
    """
    Single page of reference data, i.e: text lines
    with geometry and a corresponding binary
    image.
    """
    page_name = models.CharField(max_length=255)
    user = models.ForeignKey(User)
    project = models.ForeignKey(OcrProject, related_name="reference_sets")
    data = fields.PickledObjectField()
    source_image = models.FileField(upload_to=ocrutils.get_refpage_path, max_length=255)
    binary_image = models.FileField(upload_to=ocrutils.get_refpage_path, max_length=255)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    updated_on = models.DateTimeField(auto_now=True, editable=False)

    class Meta:
        unique_together = ("project", "source_image", "binary_image")

    def thumbnail_path(self):
        """
        Path to where the thumbnail should be.
        """
        return "%s.thumb.jpg" % os.path.splitext(self.source_image.path)[0] 

    def thumbnail_url(self):
        """
        Url to thumbnail resource.
        """
        return ocrutils.media_path_to_url(self.thumbnail_path())

    def __unicode__(self):
        """
        Unicode representation.
        """
        return self.page_name

