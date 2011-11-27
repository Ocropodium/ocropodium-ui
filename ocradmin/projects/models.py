"""
Object representing an OCR project, used to group files, batches, 
and presets.
"""

import datetime
from django.db import models
from django.contrib.auth.models import User
from tagging import fields as taggingfields
import autoslug
from ocradmin.core import utils as ocrutils

from ocradmin.storage import registry


class Project(models.Model):
    """
    OCR Project model.
    """
    name = models.CharField(max_length=255, unique=True)
    slug = autoslug.AutoSlugField(populate_from="name", unique=True)
    description = models.TextField(blank=True)
    tags = taggingfields.TagField()
    storage_backend = models.CharField(max_length=255, 
                choices=[(k, k) for k in registry.stores.keys()])
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)

    def __unicode__(self):
        """
        String representation.
        """
        return self.name

    def storage_config_dict(self):
        """Return a dictionary of storage config values."""
        return dict([(c.name, c.value) \
                for c in self.storage_config_values.all()])

    def get_storage(self):
        backend = registry.stores[self.storage_backend]
        return backend(**self.storage_config_dict())

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(Project, self).save()

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/projects/show/%i/" % self.id

    def get_update_url(self):
        """url to update an object detail"""
        return "/projects/edit/%i/" % self.id

    def get_delete_url(self):
        """url to update an object detail"""
        return "/projects/delete/%i/" % self.id

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/projects/list/"

    @classmethod
    def get_create_url(cls):
        """URL to create a new object"""
        return "/projects/create/"


class ProjectStorageConfig(models.Model):
    """Project storage config values."""
    project = models.ForeignKey(Project, related_name="storage_config_values")
    name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)

    def __unicode__(self):
        """
        String representation.
        """
        return u"<%s='%s'>" % (self.name, self.value)



