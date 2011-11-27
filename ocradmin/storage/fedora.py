"""
Fedora storage backend.
"""

from django import forms
import eulfedora

from . import base


class ConfigForm(base.BaseConfigForm):
    host = forms.CharField(max_length=20)
    port = forms.IntegerField()
    username = forms.CharField(max_length=255)
    password = forms.CharField(max_length=255, widget=forms.PasswordInput)
    context = forms.CharField(max_length=255)
    image_name = forms.CharField(max_length=255)
    transcript_name = forms.CharField(max_length=255)


class FedoraStorage(base.BaseStorage):
    """Fedora Commons repository storage."""

    configform = ConfigForm


