from django import forms
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.core import serializers
from django.db.models import Q
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.template import Template, Context
from django.template.loader import get_template

from tagging.models import TaggedItem

from ocradmin.ocrpresets.models import OcrPreset


class OcrPresetForm(forms.ModelForm):
    """
        Base preset form
    """
    def __init__(self, *args, **kwargs):
        super(OcrModelForm, self).__init__(*args, **kwargs)

    class Meta:
        model = OcrPreset
        fields = ["name", "tags",]
        exclude = ["user", "tags", "description", "data", "public", "type"]



def index(request):
    """
    List available presets.
    """

    return list(request)


def list(request):
    """
    List available presets.
    """

    return Http404


def show(request, pk):
    """
    Show a preset's details.
    """

    return Http404


def new(request):
    """
    Start a new preset.
    """

    return Http404


def create(request):
    """
    Create a new preset.
    """

    return Http404


def edit(request, pk):
    """
    Edit a preset.
    """

    return Http404


def update(request, pk):
    """
    Update a preset.
    """

    return Http404



def delete(request, pk):
    """
    Delete a preset.
    """

    return Http404



def search(request):
    """
    Search available presets.
    """

    return Http404




