"""
A Reference Page is an OCR object that consists of a source
image, a binarized image, and a transcript of lines relating
to the latter.
"""

import os
import datetime
from django.db import models
from django.contrib.auth.models import User
from ocradmin.projects.models import Project
from ocradmin.core import utils as ocrutils


class ReferencePage(models.Model):
    """
    Single page of reference data, i.e: text lines
    with geometry and a corresponding binary
    image.
    """
    page_name = models.CharField(max_length=255)
    user = models.ForeignKey(User, related_name="reference_sets")
    project = models.ForeignKey(Project, related_name="reference_sets")
    data = models.TextField()
    source_image = models.FileField(upload_to=ocrutils.get_refpage_path, max_length=255)
    binary_image = models.FileField(upload_to=ocrutils.get_refpage_path, max_length=255)
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)

    class Meta:
        unique_together = ("project", "source_image", "binary_image")

    def __unicode__(self):
        """
        Unicode representation.
        """
        return self.page_name

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(ReferencePage, self).save()

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

