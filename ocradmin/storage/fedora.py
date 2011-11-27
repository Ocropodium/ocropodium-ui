"""
Fedora storage backend.
"""

from django import forms
from django.conf import settings
import eulfedora

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


