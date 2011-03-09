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
from django.utils import simplejson

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

    presets = OcrPreset.objects.filter(type=request.GET.get("type", ""))
    response = HttpResponse(mimetype="application/json")
    serializers.serialize("json", presets, ensure_ascii=False, 
            fields=("name", "description"), stream=response)

    return response


def data(request, pk):
    """
    Get a preset's unpickled data.
    """
    preset = get_object_or_404(OcrPreset, pk=pk)
    return HttpResponse(simplejson.dumps(preset.data), 
            mimetype="application/json")


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

    pname = request.POST.get("preset_name")
    pdesc = request.POST.get("preset_description")
    ptype = request.POST.get("preset_type")

    data = {}
    for key, val in request.POST.iteritems():
        if key.startswith("ocrdata_"):
            paramname = key.replace("ocrdata_", "", 1)
            data[paramname] = val

    preset = OcrPreset(name=pname, description=pdesc, 
            type=ptype, data=data, user=request.user)
    preset.save()

    response = HttpResponse(mimetype="application/json")
    serializers.serialize("json", [preset], ensure_ascii=False, 
            fields=("name", "description"), stream=response)
    return response


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
    preset = get_object_or_404(OcrPreset, pk=pk)
    preset.delete()

    presets = OcrPreset.objects.filter(type=preset.type)
    response = HttpResponse(mimetype="application/json")
    serializers.serialize("json", presets, ensure_ascii=False, 
            fields=("name", "description"), stream=response)

    return response


def search(request):
    """
    Search available presets.
    """

    return Http404




