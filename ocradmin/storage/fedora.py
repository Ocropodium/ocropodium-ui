"""
Fedora storage backend.
"""

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
        self.repo = Repository(
                root=kwargs["root"], username=kwargs["username"],
                password=kwargs["password"])
        self.model = type("Document", (DigitalObject,), {
            "default_pidspace": kwargs["namespace"],
            "FILE_CONTENT_MODEL": "info:fedora/genrepo:File-1.0",
            "CONTENT_MODELS":     ["info:fedora/genrepo:File-1.0"],
            "image": FileDatastream(kwargs["image_name"], "Document image", defaults={
              'versionable': True,
            }),
            "transcript": FileDatastream(kwargs["transcript_name"], "Document transcript", defaults={
                "versionable": True,
            }),
        })

    def create(self):
        """Get a new document object"""
        return self.repo.get_object(type=self.model)

    def get(self, id):
        """Get an object by id."""
        return self.repo.get_object(id)

    def delete(self, pid, msg=None):
        """Delete an object."""
        self.repo.purge_object(pid, logMessage=msg)

    def list(self, namespace=None):
        """List documents in the repository."""
        ns = namespace if namespace is not None else self.namespace
        return self.repo.find_objects("%s:*" % ns)
        


