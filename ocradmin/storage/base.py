"""
Storage backend base class.
"""

import os
import re
import io
import textwrap
from contextlib import contextmanager
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

    def document_attr_dzi_path(self, doc, attr):
        return "%s/dzi/%s/%s/%s.dzi" % (
                settings.MEDIA_ROOT,
                self.namespace,
                doc.pid, attr)

    def attr_uri(self, doc):
        """URI for image datastream."""
        raise NotImplementedError

    def document_label(self, doc):
        """Get the document label."""
        raise NotImplementedError

    def document_attr_empty(self, doc, attr):
        """Check if an attr is missing or empty."""
        raise NotImplementedError

    def document_attr_label(self, doc, attr):
        """Get the document image label."""
        raise NotImplementedError

    def document_attr_mimetype(self, doc, attr):
        """Get the document image mimetype."""
        raise NotImplementedError

    def document_attr_content_handle(self, doc, attr):
        """Get document image content.  Currently
        EULFedora doesn't support a streaming content
        API so we have to load it into an in memory
        buffer."""
        raise NotImplementedError

    @contextmanager
    def document_attr_content(self, doc, attr):
        """Get the document image content as a stream."""
        handle = self.document_attr_content_handle(doc, attr)
        try:
            yield handle
        finally:
            handle.close()

    def read_metadata(self, doc):
        """Get a dictionary of document metadata."""
        raise NotImplementedError

    def write_metadata(self, doc, **kwargs):
        """Get a dictionary of document metadata."""
        raise NotImplementedError

    def merge_metadata(self, doc, **kwargs):
        meta = self.read_metadata(doc)
        meta.update(kwargs)
        self.write_metadata(doc, **meta)

    def delete_metadata(self, *args):
        meta = self.read_metadata(doc)
        newmeta = dict([(k, v) for k, v in meta.iteritems() \
                if k not in args])
        self.write_metadata(doc, **newmeta)

    def set_document_attr_content(self, doc, attr, content):
        """Set image content."""
        raise NotImplementedError

    def set_document_attr_mimetype(self, doc, attr, mimetype):
        """Set image mimetype."""
        raise NotImplementedError

    def set_document_attr_label(self, doc, attr, label):
        """Set image label."""
        raise NotImplementedError

    def set_document_label(self, doc, label):
        """Set document label."""
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

    def list_pids(self):
        """List of pids."""
        raise NotImplementedError

    def next(self, pid):
        """Get next pid to this one"""
        plist = self.list_pids()
        idx = plist.index(pid)
        if len(plist) == idx - 1:
            return None
        return plist[idx + 1]

    def prev(self, pid):
        """Get previous pid to this one."""
        plist = self.list_pids()
        idx = plist.index(pid)
        if idx == 0:
            return None
        return plist[idx - 1]        

    @classmethod
    def pid_index(cls, namespace, pid):
        """Get the numerical index of a pid."""
        match = re.match("^" + namespace + ":(\d+)$", pid)
        if match:
            return int(match.groups()[0])

    @classmethod
    def sort_pidlist(cls, namespace, pidlist):
        """Sort a pid list numerically."""
        def sfunc(a, b):
            return cls.pid_index(namespace, a) - cls.pid_index(namespace, b)
        return sorted(pidlist, sfunc)


class BaseDocumentType(type):
    """Metaclass to generate accessors for document
    image attributes.  At present, an OCR document 
    has three image members (image, binary, thumbnail)
    which each have three accessible properties (label,
    content, and mimetype.)  These are all accessed via
    the backend storage `document_attr_<attr>`
    methods."""
    def __new__(cls, name, bases, attrs):
        new = super(BaseDocumentType, cls).__new__
        if attrs.pop("abstract", None):
            return new(cls, name, bases, attrs)
        doccls = new(cls, name, bases, attrs)
        for obj in ["image", "thumbnail", "binary", "transcript", "script"]:
            for attr in ["label", "mimetype", "content"]:
                generate_image_attr_accessors(doccls, obj, attr)
        return doccls


def generate_image_attr_accessors(cls, objattr, attr):
    def getter(self):
        meth = getattr(self._storage, "document_attr_%s" % attr)
        return meth(self, objattr)
    getter.__doc__ = "Get %s %s" % (objattr, attr)
    getter.__name__ = "get_%s_%s" % (objattr, attr)
    setattr(cls, getter.__name__, getter)

    def setter(self, value):
        meth = getattr(self._storage, "set_document_attr_%s" % attr)
        meth(self, objattr, value)
    setter.__doc__ = "Set %s %s" % (objattr, attr)
    setter.__name__ = "set_%s_%s" % (objattr, attr)
    setattr(cls, setter.__name__, setter)
    setattr(cls, "%s_%s" % (objattr, attr), property(getter, setter))

    def checker(self):
        meth = getattr(self._storage, "document_attr_empty")
        return meth(self, objattr)
    checker.__doc__ = "Check if %s is empty" % objattr
    checker.__name__ = "%s_empty" % objattr
    setattr(cls, checker.__name__, checker)
    setattr(cls, "%s_empty" % objattr, property(checker))


class BaseDocument(object):
    """Document model abstract class.  Just provides
    a thin object abstraction object each storage backend."""
    __metaclass__ = BaseDocumentType
    abstract = True

    def __init__(self, pid, storage):
        """Initialise the Document with an image path/handle."""
        self.pid = pid
        self._storage = storage
        self._deleted = False
        self._metacache = None

    def __repr__(self):
        return "<Document: %s>" % self.label

    def __unicode__(self):
        """Unicode representation."""
        return self.label

    def save(self):
        """Save objects, settings dates if necessary
        and writing all cached datastreams to storage."""                
        self._storage.save_document(self)

    def process_thumbnail(self, pil):
        """Process thumbnail, padding to a constant size"""
        size = settings.THUMBNAIL_SIZE
        pil.thumbnail(settings.THUMBNAIL_SIZE, Image.ANTIALIAS)
        back = Image.new("RGBA", settings.THUMBNAIL_SIZE)
        back.paste((255,255,255,0), (0, 0, size[0], size[1]))
        back.paste(pil, ((size[0] - pil.size[0]) / 2, (size[1] - pil.size[1]) / 2))
        return back

    def make_thumbnail(self):
        """Create a thumbnail of the main image."""
        with self.image_content as handle:
            im = Image.open(handle)
            thumb = self.process_thumbnail(im)
            # FIXME: This is NOT elegant... 
            try:
                stream = StringIO()
                thumb.save(stream, "PNG")
                self.thumbnail_mimetype = "image/png"
                self.thumbnail_label = "%s.thumb.png" % os.path.splitext(
                        self.image_label)[0]
                self.thumbnail_content = stream
                self.save()
            finally:
                stream.close()

    @property
    def transcript_url(self):
        return "/documents/edit/%s/" % self.pid

    @property
    def image_uri(self):
        return self._storage.attr_uri(self, "image")

    @property
    def thumbnail_uri(self):
        return self._storage.attr_uri(self, "thumbnail")

    @property
    def ocr_status(self):
        return self.get_metadata("ocr_status")

    @property
    def label(self):
        return self._storage.document_label(self)

    @property
    def metadata(self):
        if self._metacache is not None:
            return self._metacache
        self._metacache = self._storage.read_metadata(self)
        return self._metacache

    @metadata.setter
    def metadata(self, meta):
        """Set arbitrary document metadata."""
        self._metacache = None
        self._storage.write_metadata(self, **dict([meta]))

    def get_metadata(self, attr=None):
        meta = self.metadata
        if attr:
            return meta.get(attr)
        return meta

    def set_metadata(self, **kwargs):
        """Set a key/pair value."""
        self._metacache = None
        self._storage.merge_metadata(self, **kwargs)

    def delete_metadata(self, *args):
        """Delete metadata keys."""
        self._metacache = None
        self._storage.delete_metadata(self, *args)

    def delete(self):
        """Delete this object."""
        self._storage.delete(self)
        self._deleted = True


