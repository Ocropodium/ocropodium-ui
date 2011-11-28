"""
Filesystem storage module.
"""

import os
import io
import re
import shutil
from django import forms
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from ocradmin.core.utils import media_path_to_url
from PIL import Image

from . import base, exceptions


class ConfigForm(base.BaseConfigForm):
    """File system storage config."""


class Document(base.BaseDocument):
    """File system document."""

    def make_thumbnail(self):
        """Create a thumbnail of the main image."""
        im = Image.open(self.image_content)
        im.thumbnail(settings.THUMBNAIL_SIZE, Image.ANTIALIAS)
        # FIXME: This is NOT elegant... 
        with io.open(os.path.join(
            self._storage.document_path(self), self._storage.thumbnail_name), "wb") as h:
            im.save(h, "JPEG")
        self.thumbnail_mimetype = "image/jpeg"
        self.save()



class FileSystemStorage(base.BaseStorage):
    """Filesystem storage backend.  A document is represented
    as a directory of datastreams, i.e:
        <project-name>:1/
            IMG   -> simlink to simple_v1.png
            IMG_Binary.png
            versions/
                simple_v1.png
                transcript-1.html
                transcript-2.html

       Datastream id is the file basename minus the suffix.
    """
    configform = ConfigForm
    image_name = "IMG"
    thumbnail_name = "THUMBNAIL"
    transcript_name = "TRANSCRIPT"
    meta_name = "meta.txt"

    def _checkconfigured(self):
        docroot = getattr(settings, "DOCUMENT_ROOT", "")
        if not os.path.exists(docroot) and os.path.isdir(docroot):
            raise ImproperlyConfigured("Document root does not exist."
                    " Make sure 'DOCUMENT_ROOT' is set in django.settings and"
                    " that it is a writable directory.")
        if not os.access(docroot, os.W_OK):
            raise ImproperlyConfigured("Document root does not appear to be writable."
                    " Make sure 'DOCUMENT_ROOT' is set in django.settings and"
                    " that it is a writable directory.")


    def __init__(self, *args, **kwargs):
        self.namespace = kwargs["namespace"]
        self._checkconfigured()

    @property
    def namespace_root(self):
        docroot = getattr(settings, "DOCUMENT_ROOT", "")
        return os.path.join(docroot, self.namespace)

    def document_path(self, doc):
        return os.path.join(self.namespace_root, doc.pid)

    def get_next_pid(self):
        """Get the next filesystem pid.  FIXME: This is not
        re-entrance or thread-safe."""
        if not os.path.exists(self.namespace_root):
            return "%s:1" % self.namespace
        pidnums = []
        for item in os.listdir(self.namespace_root):
            if os.path.isdir(os.path.join(self.namespace_root, item)):
                match = re.match("^" + self.namespace + ":(\d+)$", item)
                if match is not None:
                    pidnums.append(int(match.group(1)))
        if not len(pidnums):
            return "%s:1" % self.namespace
        return "%s:%d" % (self.namespace, max(sorted(pidnums)) + 1)

    def read_metadata(self, doc):
        metapath = os.path.join(self.document_path(doc), self.meta_name)
        if not os.path.exists(metapath):
            return {}
        with io.open(metapath, "r") as metahandle:
            return dict([v.strip().split("=") for v in \
                    metahandle.readlines() if re.match("^\w+=[^=]+$", v.strip())])

    def write_metadata(self, doc, newmeta):
        metapath = os.path.join(self.document_path(doc), self.meta_name)
        meta = self.read_metadata(doc)
        print "Writing metadata, existing meta is %s" % meta
        meta.update(newmeta)
        with io.open(metapath, "w") as metahandle:
            for k, v in meta.iteritems():
                print "Writing metadata value %s = %s" % (k, v)
                metahandle.write(u"%s=%s\n" % (k, v))
            #metahandle.writelines([u"%s=%s\n" % (k, v) \
            #        for k, v in meta.iteritems()])
        print "Wrote metadata, readback is %s" % self.read_metadata(doc)

    def create_document(self, label):
        """Get a new document object"""
        pid = self.get_next_pid()
        # better that this fails than try to handle it
        os.makedirs(os.path.join(self.namespace_root, pid))
        doc = Document(pid, self)
        self.write_metadata(doc, dict(label=label))
        return doc

    def save_document(self, doc):
        """Save document contents."""
        pass

    def image_uri(self, doc):
        """URI for image datastream."""
        return media_path_to_url(
                os.path.join(self.document_path(doc), self.image_name))

    def thumbnail_uri(self, doc):
        """URI for thumbnail datastream."""
        return media_path_to_url(
                os.path.join(self.document_path(doc), self.thumbnail_name))

    def document_label(self, doc):
        """Get the document label."""
        return self.read_metadata(doc).get("label", "")

    def document_image_label(self, doc):
        """Get the document image label."""
        return self.read_metadata(doc).get("image_label", "")

    def document_image_mimetype(self, doc):
        """Get the document image mimetype."""
        return self.read_metadata(doc).get("image_mimetype", "")

    def document_image_content(self, doc):
        """Get the document image content as a stream."""
        imgpath = os.path.join(self.document_path(doc), self.image_name)
        if os.path.exists(imgpath):
            return io.open(imgpath, "rb")

    def set_document_image_content(self, doc, content):
        """Set image content."""
        imgpath = os.path.join(self.document_path(doc), self.image_name)
        with io.open(imgpath, "wb") as imghandle:
            imghandle.write(content.read())

    def set_document_thumbnail_content(self, doc, content):
        """Set thumbnail content."""
        print "WRITING THUMBNAIL for", doc.pid
        imgpath = os.path.join(self.document_path(doc), self.thumbnail_name)
        with io.open(imgpath, "wb") as imghandle:
            imghandle.write(content.read())

    def set_document_image_mimetype(self, doc, mimetype):
        """Set image mimetype."""
        self.write_metadata(doc, dict(image_mimetype=mimetype))

    def set_document_thumbnail_mimetype(self, doc, mimetype):
        """Set thumbnail mimetype."""
        self.write_metadata(doc, dict(thumbnail_mimetype=mimetype))

    def set_document_image_label(self, doc, label):
        """Set image label."""
        self.write_metadata(doc, dict(image_label=label))        

    def set_document_label(self, doc, label):
        """Set document label."""
        self.write_metadata(doc, dict(label=label))

    def set_document_metadata(self, doc, **kwargs):
        """Set arbitrary document metadata."""
        self.write_metadata(doc, kwargs)

    def get(self, pid):
        """Get an object by id."""
        if os.path.exists(os.path.join(self.name_space_root, pid)):
            return Document(pid)

    def delete(self, doc, msg=None):
        """Delete an object."""
        # TODO: Make more robust
        shutil.rmtree(self.document_path(doc))

    def list(self, namespace=None):
        """List documents in the repository."""
        return [Document(pid, self) for pid in sorted(os.listdir(self.namespace_root)) \
                if os.path.isdir(os.path.join(self.namespace_root, pid)) and \
                    re.match("^" + self.namespace + ":\d+$", pid)]
        

