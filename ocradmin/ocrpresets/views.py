from django import forms
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.core import serializers
from django.db.models import Q
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.shortcuts import render, get_object_or_404
from django.utils import simplejson

from tagging.models import TaggedItem

from ocradmin.ocrpresets.models import OcrPreset


class OcrPresetForm(forms.ModelForm):
    """
        Base preset form
    """
    def __init__(self, *args, **kwargs):
        super(OcrPresetForm, self).__init__(*args, **kwargs)
        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40

    class Meta:
        model = OcrPreset
        fields = ["name", "tags", "description", "public", "data"]
        exclude = ["user", "created_on", "updated_on"]




def index(request):
    """
    List available presets.
    """

    return list(request)


def list(request):
    """
    List available presets.
    """

    presets = OcrPreset.objects.all()
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


@login_required
def new(request):
    """
        Show the new model form.
    """
    form = OcrPresetForm()
    context = {"form": form}
    template = "ocrpresets/new.html" if not request.is_ajax() \
            else "ocrpresets/includes/new_preset_form.html"
    return render(request, template, context)


@login_required
def create(request):
    """
        Create a new preset.
    """
    print request.POST
    form = OcrPresetForm(request.POST)
    if not form.is_valid():
        context = {"form": form}
        template = "ocrpresets/new.html" if not request.is_ajax() \
                else "ocrpresets/includes/new_model_form.html"
        return render(request, template, context)
    preset = form.instance
    preset.user = request.user
    preset.full_clean()
    preset.save()
    messages.success(request, "Preset was created successfully.")
    return HttpResponseRedirect("/ocrpresets/list")


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




