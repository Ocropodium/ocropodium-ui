"""
Fedora storage backend.
"""

import io
import urllib
from django import forms
from django.conf import settings
import eulfedora

from eulfedora.server import Repository
from eulfedora.models import DigitalObject, FileDatastream

from . import base



class ConfigForm(base.BaseConfigForm):
    root = forms.CharField(max_length=255)
    username = forms.CharField(max_length=255)
    password = forms.CharField(max_length=255, widget=forms.PasswordInput)
    image_name = forms.CharField(max_length=255)
    transcript_name = forms.CharField(max_length=255)


class FedoraDocument(base.BaseDocument):
    """Fedora document class."""
    def __init__(self, digiobj, storage):
        self._doc = digiobj
        self._storage = storage

    @property
    def pid(self):
        return self._doc.pid
    

class FedoraStorage(base.BaseStorage):
    """Fedora Commons repository storage."""

    configform = ConfigForm
    defaults = dict(
            root=getattr(settings, "FEDORA_ROOT", ""),
            username=getattr(settings, "FEDORA_USER", ""),
            password=getattr(settings, "FEDORA_PASS", ""),
            namespace=getattr(settings, "FEDORA_PIDSPACE", ""),
            image_name=getattr(settings, "FEDORA_IMAGE_NAME", ""),
            transcript_name=getattr(settings, "FEDORA_TRANSCRIPT_NAME", "")
    )

    def __init__(self, *args, **kwargs):
        super(FedoraStorage, self).__init__(*args, **kwargs)
        self.namespace = kwargs["namespace"]
        self.image_name = kwargs["image_name"]
        self.thumbnail_name = "THUMBNAIL"
        self.transcript_name = kwargs["transcript_name"]

        self.repo = Repository(
                root=kwargs["root"], username=kwargs["username"],
                password=kwargs["password"])

        self.model = type("Document", (DigitalObject,), {
            "default_pidspace": kwargs["namespace"],
            "FILE_CONTENT_MODEL": "info:fedora/genrepo:File-1.0",
            "CONTENT_MODELS":     ["info:fedora/genrepo:File-1.0"],
            "image": FileDatastream(self.image_name, "Document image", defaults={
              'versionable': True,
            }),
            "thumbnail": FileDatastream(self.thumbnail_name, "Document image thumbnail", defaults={
              'versionable': True,
            }),
            "transcript": FileDatastream(self.transcript_name, "Document transcript", defaults={
                "versionable": True,
            }),
        })

    def image_uri(self, doc):
        """URI for image datastream."""
        return "%sobjects/%s/datastreams/%s/content" % (
                self.repo.fedora_root,
                urllib.quote(doc.pid),
                self.image_name
        )

    def thumbnail_uri(self, doc):
        """URI for image datastream."""
        return "%sobjects/%s/datastreams/%s/content" % (
                self.repo.fedora_root,
                urllib.quote(doc.pid),
                self.thumbnail_name
        )

    def document_label(self, doc):
        """Get the document label."""
        return doc._doc.label

    def document_image_label(self, doc):
        """Get the document image label."""
        return doc._doc.image.label

    def document_image_mimetype(self, doc):
        """Get the document image mimetype."""
        return doc._doc.image.mimetype

    def document_thumbnail_mimetype(self, doc):
        """Get the document thumbnail mimetype."""
        return doc._doc.thumbnail.mimetype

    def document_image_content(self, doc):
        """Get document image content.  Currently
        EULFedora doesn't support a streaming content
        API so we have to load it into an in memory
        buffer."""
        return doc._doc.image.content

    def document_thumbnail_content(self, doc):
        """Get document image content.  Ditto issue
        with Fedora streaming."""
        return doc._doc.thumbnail.content

    def document_metadata(self, doc):
        """Get document metadata. This currently
        just exposes the DC stream attributes."""
        return doc._doc.dc.content

    def set_document_image_content(self, doc, content):
        """Set image content."""
        doc._doc.image.content = content

    def set_document_thumbnail_content(self, doc, content):
        """Set thumbnail content."""
        doc._doc.thumbnail.content = content

    def set_document_image_mimetype(self, doc, mimetype):
        """Set image mimetype."""
        doc._doc.image.mimetype = mimetype

    def set_document_thumbnail_mimetype(self, doc, mimetype):
        """Set thumbnail mimetype."""
        doc._doc.thumbnail.mimetype = mimetype

    def set_document_image_label(self, doc, label):
        """Set image label."""
        doc._doc.image.label = label

    def set_document_label(self, doc, label):
        """Set document label."""
        doc._doc.label = label

    def set_document_metadata(self, doc, **kwargs):
        """Set arbitrary document metadata."""
        for attr, value in kwargs.iteritems():
            setattr(doc._doc.dc.content, attr, value)

    def save_document(self, doc):
        """Save document."""
        doc._doc.save()

    def create_document(self, label):
        """Get a new document object"""
        doc = self.repo.get_object(type=self.model)
        doc.label = label
        return FedoraDocument(doc, self)

    def get(self, pid):
        """Get an object by id."""
        return self.repo.get_object(pid)

    def delete(self, doc, msg=None):
        """Delete an object."""
        self.repo.purge_object(doc.pid, log_message=msg)

    def list(self, namespace=None):
        """List documents in the repository."""
        ns = namespace if namespace is not None else self.namespace
        return [FedoraDocument(d, self) \
                for d in self.repo.find_objects("%s:*" % ns, type=self.model)]
        


