"""
Filesystem storage module.
"""

import os
import io
import re
import shutil
from cStringIO import StringIO
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
        with self.image_content as handle:
            im = Image.open(handle)
            thumb = self.process_thumbnail(im)
            # FIXME: This is NOT elegant... 
            with io.open(os.path.join(
                self._storage.document_path(self), self._storage.thumbnail_name), "wb") as h:
                thumb.save(h, "PNG")
        self.thumbnail_label = "%s.thumb.png" % os.path.splitext(self.image_label)[0]
        self.thumbnail_mimetype = "image/png"
        self.save()



# README: This is a very naive and inefficient file-based repository.
# Currently nothing is cached and all attribute updates are written
# immediately.
class FileSystemStorage(base.BaseStorage):
    """Filesystem storage backend.  A document is represented
    as a directory of datastreams, i.e:
        <project-name>:1/
            IMG
            THUMBNAIL
            TRANSCRIPT
            meta.txt
    """
    configform = ConfigForm
    image_name = "IMG"
    binary_name = "BINARY"
    thumbnail_name = "THUMBNAIL"
    transcript_name = "TRANSCRIPT"
    script_name = "OCR_SCRIPT"
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
        re-entrance or thread-safe (but then not much else is!)"""
        if not os.path.exists(self.namespace_root):
            return "%s:1" % self.namespace
        pidnums = []
        for item in os.listdir(self.namespace_root):
            if os.path.isdir(os.path.join(self.namespace_root, item)):
                pidindex = self.pid_index(self.namespace, item)
                if pidindex is not None:
                    pidnums.append(pidindex)
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

    def write_metadata(self, doc, **kwargs):
        metapath = os.path.join(self.document_path(doc), self.meta_name)
        with io.open(metapath, "w") as metahandle:
            for k, v in kwargs.iteritems():
                metahandle.write(u"%s=%s\n" % (k, v))

    def create_document(self, label):
        """Get a new document object"""
        pid = self.get_next_pid()
        # better that this fails than try to handle it
        os.makedirs(os.path.join(self.namespace_root, pid))
        doc = Document(pid, self)
        self.write_metadata(doc, label=label)
        return doc

    def save_document(self, doc):
        """Save document contents."""
        pass

    def attr_uri(self, doc, attr):
        """URI for image datastream."""
        return media_path_to_url(
                os.path.join(self.document_path(doc), getattr(self, "%s_name" % attr)))

    def document_label(self, doc):
        """Get the document label."""
        return self.read_metadata(doc).get("label", "")

    def document_attr_empty(self, doc, attr):
        """Check if document attr is empty."""
        path = os.path.join(
                self.document_path(doc), getattr(self, "%s_name" % attr))
        return not os.path.exists(path) or os.stat(path)[6] == 0

    def document_attr_label(self, doc, attr):
        """Get the document image label."""
        return self.read_metadata(doc).get("%s_label" % attr, "")

    def document_attr_mimetype(self, doc, attr):
        """Get the document image mimetype."""
        return self.read_metadata(doc).get("%s_mimetype" % attr, "")

    def document_attr_content_handle(self, doc, attr):
        """Get a handle to a document attribute's content. This
        should be closed when finished, or used via the context
        manager method `document_attr_content`."""
        imgpath = os.path.join(
                self.document_path(doc), getattr(self, "%s_name" % attr))
        if os.path.exists(imgpath):
            return io.open(imgpath, "rb")
        return StringIO("")

    def set_document_attr_content(self, doc, attr, content):
        """Set image content."""
        imgpath = os.path.join(self.document_path(doc), getattr(self, "%s_name" % attr))
        with io.open(imgpath, "wb") as imghandle:
            if content is None:
                imghandle.truncate()
            elif isinstance(content, basestring):
                imghandle.write(content)
            else:
                imghandle.write(content.read())

    def set_document_attr_mimetype(self, doc, attr, mimetype):
        """Set image mimetype."""
        self.write_metadata(doc, **{"%s_mimetype" % attr: mimetype})

    def set_document_attr_label(self, doc, attr, label):
        """Set image label."""
        self.write_metadata(doc, **{"%s_label" % attr: label})

    def set_document_label(self, doc, label):
        """Set document label."""
        self.write_metadata(doc, label=label)

    def get(self, pid):
        """Get an object by id."""
        if os.path.exists(os.path.join(self.namespace_root, pid)):
            return Document(pid, self)

    def delete(self, doc, msg=None):
        """Delete an object."""
        # TODO: Make more robust
        shutil.rmtree(self.document_path(doc))
        # if  we're deleting the last object
        # also delete the namespace root.
        # Just try this and ignore the error
        try:
            os.rmdir(self.namespace_root)
        except OSError:
            pass

    def list(self, namespace=None):
        """List documents in the repository."""
        if not os.path.exists(self.namespace_root):
            return []
        return [Document(pid, self) for pid in self.list_pids()]

    def list_pids(self, namespace=None):
        if not os.path.exists(self.namespace_root):
            return []
        return self.sort_pidlist(self.namespace, 
                [p for p in os.listdir(self.namespace_root) \
                    if os.path.isdir(os.path.join(self.namespace_root, p)) and \
                        not self.pid_index(self.namespace, p) is None])

    def next(self, pid):
        """Get next pid to this one"""
        plist = self.list_pids()
        idx = plist.index(pid)
        if len(plist) == idx + 1:
            return None
        return plist[idx + 1]

    def prev(self, pid):
        """Get previous pid to this one."""
        plist = self.list_pids()
        idx = plist.index(pid)
        if idx == 0:
            return None
        return plist[idx - 1]        

