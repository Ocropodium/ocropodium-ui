from django.db import models

from ocradmin.projects.models import Project
from ocradmin import storage

from django.conf import settings


class Document(object):
    """Document model."""
    name = models.CharField(max_length=255)
    project = models.ForeignKey(Project)
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)

    def __unicode__(self):
        """Unicode representation."""
        return self.name

    def save(self):
        """Save objects, settings dates if necessary."""
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()

    def _set_name(self, name):
        pass

    def get_datastream_path(self, streamname):
        """Get a datastream path."""
        return backend.get_datastream_path(self.storage_id, streamname)

    




