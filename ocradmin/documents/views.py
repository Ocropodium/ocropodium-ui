# Create your views here.

import json
from django import forms
from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from ocradmin import storage
from ocradmin.core.decorators import project_required
from ocradmin.core import generic_views as gv
from ocradmin.presets.models import Preset, Profile

from cStringIO import StringIO

class DocumentForm(forms.Form):
    """New document form."""
    label = forms.CharField(max_length=255, required=False)
    file = forms.FileField()


@project_required
def doclist(request):
    """List documents."""
    storage = request.session["project"].get_storage()
    template = "documents/list.html" if not request.is_ajax() \
            else "documents/includes/document_list.html"
    profiles = Profile.objects.filter(name="Batch OCR")
    presets = Preset.objects.order_by("name").all()
    if profiles:
        presets = profiles[0].presets.order_by("name").all()

    context = dict(
            page_name="%s: Documents" % storage.name,
            objects=storage.list(),
            presets=presets
    )
    return render(request, template, context)


@project_required
def edit(request, pid):
    """Edit document with `id`."""
    storage = request.session["project"].get_storage()
    doc = storage.get(pid)
    return render(request, "document/edit.html", dict(object=doc))


@project_required
def create(request):
    """Create a new document."""
    store = request.session["project"].get_storage()
    if not request.method == "POST":
        form = DocumentForm()
        return render(request, "documents/create.html", dict(
            form=form, page_name="%s: Add document" % store.name)
        )

    form = DocumentForm(request.POST, request.FILES)
    if form.is_valid():
        if not form.cleaned_data["label"]:
            form.cleaned_data["label"] = request.FILES["file"].name 
        doc = store.create_document(form.cleaned_data["label"])
        doc.image_content = request.FILES["file"]
        doc.image_mimetype = request.FILES["file"].content_type
        doc.image_label = request.FILES["file"].name
        doc.add_metadata("title", form.cleaned_data["label"])
        doc.add_metadata("status", "draft")
        doc.make_thumbnail()
        doc.save()
        # TODO: Make async
        #doc.save()
    return HttpResponseRedirect("/documents/list")

@project_required
def show_small(request, pid):
    """Render a document's details."""
    store = request.session["project"].get_storage()
    doc = store.get(pid)
    template = "documents/includes/document.html"
    return render(request, template, dict(object=doc))


@csrf_exempt
@project_required
def create_ajax(request):
    """Create new documents with an Ajax POST."""
    store = request.session["project"].get_storage()
    pid = None
    if request.method == "POST" and request.GET.get("inlinefile"):
        filename = request.GET.get("inlinefile")
        doc = store.create_document(filename)
        doc.image_content = StringIO(request.raw_post_data)
        doc.image_mimetype = request.META.get("HTTP_X_FILE_TYPE")
        doc.image_label = filename
        doc.add_metadata("title", filename)
        doc.add_metadata("status", "draft")
        doc.make_thumbnail()
        doc.save()
        pid = doc.pid
    response = HttpResponse(mimetype="application/json")
    json.dump(dict(pid=pid), response)
    return response


@project_required
def detail(request, pid):
    storage = request.session["project"].get_storage()
    doc = storage.get(pid)
    return render(request, "document/details.html", dict(object=doc))


@project_required
def delete(request, pid):
    storage = request.session["project"].get_storage()
    doc = storage.get(pid)
    return render(request, "document/delete.html", dict(object=doc))

