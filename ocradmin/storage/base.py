"""
Storage backend base class.
"""

import io
import textwrap
from django import forms
from django.conf import settings
from . import registry

from PIL import Image
from cStringIO import StringIO


class BaseConfigForm(forms.Form):
    """Base class for config form values."""
    namespace = forms.CharField(max_length=255)


class StorageType(type):
    """Storage metaclass. Registers each storage
    backend on initialisation."""
    def __new__(cls, name, bases, attrs):
        new = super(StorageType, cls).__new__
        store_module = attrs.get("__module__") or "__main__"

         # Abstract class: abstract attribute should not be inherited.
        if attrs.pop("abstract", None) or not attrs.get("autoregister", True):
            return new(cls, name, bases, attrs)

        # Automatically generate missing/empty name, description, arity.
        autoname = False
        if not attrs.get("name"):
            attrs["name"] = name
            autoname = True

        store_name = attrs["name"]
        if store_name not in registry.stores:
            storecls = new(cls, name, bases, attrs)

            if attrs.get("description") is None:
                doc = attrs.get("__doc__") or ""
                storecls.description = textwrap.dedent(doc).strip()
            registry.stores.register(storecls)
        return registry.stores[store_name]

    def __repr__(cls):
        return "<class Storage %s>" % cls.name
            

class BaseStorage(object):
    """Base class for document storage backends."""
    __metaclass__ = StorageType
    abstract = True

    configform = BaseConfigForm
    defaults = {}

    def __init__(self, *args, **kwargs):
        self.namespace = kwargs["namespace"]

    def image_uri(self, doc):
        """URI for image datastream."""
        raise NotImplementedError

    def thumbnail_uri(self, doc):
        """URI for image datastream."""
        raise NotImplementedError

    def document_label(self, doc):
        """Get the document label."""
        raise NotImplementedError

    def document_image_label(self, doc):
        """Get the document image label."""
        raise NotImplementedError

    def document_image_mimetype(self, doc):
        """Get the document image mimetype."""
        raise NotImplementedError

    def document_image_content(self, doc):
        """Get document image content.  Currently
        EULFedora doesn't support a streaming content
        API so we have to load it into an in memory
        buffer."""
        raise NotImplementedError

    def document_metadata(self, doc):
        """Get document metadata. This currently
        just exposes the DC stream attributes."""
        raise NotImplementedError

    def set_document_image_content(self, doc, content):
        """Set image content."""
        raise NotImplementedError

    def set_document_image_mimetype(self, doc, mimetype):
        """Set image mimetype."""
        raise NotImplementedError

    def set_document_image_label(self, doc, label):
        """Set image label."""
        raise NotImplementedError

    def set_document_label(self, doc, label):
        """Set document label."""
        raise NotImplementedError

    def set_document_metadata(self, doc, **kwargs):
        """Set arbitrary document metadata."""
        raise NotImplementedError

    def save_document(self, doc):
        """Save document."""
        raise NotImplementedError

    def create_document(self, label):
        """Get a new document object"""
        raise NotImplementedError

    def get(self, id):
        """Get an object by id."""
        raise NotImplementedError

    def delete(self, pid, msg=None):
        """Delete an object."""
        raise NotImplementedError

    def list(self, namespace=None):
        """List documents in the repository."""
        raise NotImplementedError


class BaseDocument(object):
    """Document model abstract class.  Just provides
    a thin object abstraction object each storage backend."""

    def __init__(self, pid, storage):
        """Initialise the Document with an image path/handle."""
        self.pid = pid
        self._storage = storage

    def __unicode__(self):
        """Unicode representation."""
        return self.label

    def save(self):
        """Save objects, settings dates if necessary
        and writing all cached datastreams to storage."""                
        self._storage.save_document(self)

    def make_thumbnail(self):
        """Create a thumbnail of the main image."""
        im = Image.open(self.image_content)
        im.thumbnail(settings.THUMBNAIL_SIZE, Image.ANTIALIAS)
        # FIXME: This is NOT elegant... 
        stream = StringIO()
        im.save(stream, "JPEG")
        self.thumbnail_mimetype = "image/jpeg"
        self.thumbnail_content = stream
        self.save()

    @property
    def image_uri(self):
        return self._storage.image_uri(self)

    @property
    def thumbnail_uri(self):
        return self._storage.thumbnail_uri(self)

    @property
    def label(self):
        return self._storage.document_label(self)

    @property
    def image_label(self):
        return self._storage.document_image_label(self)

    @property
    def image_mimetype(self):
        return self._storage.document_image_mimetype(self)

    @property
    def thumbnail_mimetype(self):
        return self._storage.document_thumbnail_mimetype(self)

    @property
    def image_content(self):
        return self._storage.document_image_content(self)

    @property
    def thumbnail_content(self):
        return self._storage.document_thumbnail_content(self)

    @property
    def metadata(self):
        return self._storage.document_metadata(self)
    
    @image_content.setter
    def image_content(self, content):
        """Set image content."""
        self._storage.set_document_image_content(self, content)

    @thumbnail_content.setter
    def thumbnail_content(self, content):
        """Set image content."""
        self._storage.set_document_thumbnail_content(self, content)

    @image_mimetype.setter
    def image_mimetype(self, mimetype):
        """Set image mimetype."""
        self._storage.set_document_image_mimetype(self, mimetype)

    @thumbnail_mimetype.setter
    def thumbnail_mimetype(self, mimetype):
        """Set thumbnail mimetype."""
        self._storage.set_document_thumbnail_mimetype(self, mimetype)

    @image_label.setter
    def image_label(self, label):
        """Set image label."""
        self._storage.set_document_image_label(self, label)

    @label.setter
    def label(self, label):
        """Set document label."""
        self._storage.set_document_label(self, label)

    @metadata.setter
    def metadata(self, meta):
        """Set arbitrary document metadata."""
        self._storage.set_document_metadata(self, meta)

    def add_metadata(self, attr, value):
        """Set a key/pair value."""
        self._storage.set_document_metadata(self, **{attr: value})



