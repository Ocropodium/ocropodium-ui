from django.db import models

from ocradmin.projects.models import Project
from ocradmin import storage

from django.conf import settings



#class DocumentBase(object):
#    """Document model abstract class.  Each storage
#    backend implements its own version of this."""
#    def __init__(self, label):
#        """Initialise the Document with an image path/handle."""
#        self._label = label        
#
#    @property
#    def label(self):
#        raise NotImplementedError
#    
#    def __unicode__(self):
#        """Unicode representation."""
#        return self.label
#
#    def save(self):
#        """Save objects, settings dates if necessary
#        and writing all cached datastreams to storage."""                
#        raise NotImplementedError
#
#    def set_image_content(self, content):
#        """Set image content."""
#        raise NotImplementedError
#
#    def set_image_mimetype(self, mimetype):
#        """Set image mimetype."""
#        raise NotImplementedError
#
#    def set_image_label(self, label):
#        """Set image label."""
#        raise NotImplementedError
#
#    def set_label(self, label):
#        """Set document label."""
#        raise NotImplementedError
#
#    def set_metadata(self, attr, value):
#        """Set arbitrary document metadata."""
#        raise NotImplementedError


