import os
from django.db import models
from django.contrib.auth.models import User
import tagging
import autoslug
from ocradmin.core import utils as ocrutils


class OcrProject(models.Model):
    """
    OCR Project model.
    """
    user = models.ForeignKey(User)
    name = models.CharField(max_length=255, unique=True)
    slug = autoslug.AutoSlugField(populate_from="name", unique=True)
    description = models.TextField(blank=True, null=True)
    tags = tagging.fields.TagField()
    created_on = models.DateTimeField(auto_now_add=True, editable=False)

    def __unicode__(self):
        """
        String representation.
        """
        return self.name

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/projects/list/"

    @classmethod
    def get_create_url(cls):
        """URL to create a new object"""
        return "/projects/create/"

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/projects/show/%i/" % self.id

    def get_update_url(self):
        """url to update an object detail"""
        return "/projects/edit/%i/" % self.id

    def get_delete_url(self):
        """url to update an object detail"""
        return "/projects/delete/%i/" % self.id


