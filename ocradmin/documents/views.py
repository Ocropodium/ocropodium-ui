# Create your views here.

import json
from django import forms
from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect, \
            HttpResponseServerError
from django.views.decorators.csrf import csrf_exempt
from ocradmin import storage
from ocradmin.documents.utils import Aspell
from ocradmin.core.decorators import project_required
from ocradmin.presets.models import Preset, Profile
from ocradmin.ocrtasks.models import OcrTask
from BeautifulSoup import BeautifulSoup

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
def transcript(request, pid):
    """Edit document transcript."""
    if not request.is_ajax():
        template = "documents/transcript.html"
        context = dict(pid=pid)
        return render(request, template, context)
    # if it's an Ajax request, write the document text to the
    # response
    storage = request.project.get_storage()
    response = HttpResponse(mimetype="text/html")
    response.write(storage.get(pid).transcript_content.read())
    return response


@project_required
def save_transcript(request, pid):
    """
    Save data for a single page.
    """
    if not request.is_ajax() and request.method == "POST":
        return transcript(request, pid)

    data = request.POST.get("data")
    if not data:
        return HttpResponseServerError("No data passed to 'save' function.")
    doc = request.project.get_storage().get(pid)
    soup = BeautifulSoup(doc.transcript_content)
    soup.find("div", {"class": "ocr_page"}).replaceWith(data)
    doc.transcript_content = StringIO(str(soup))
    doc.save()
    # FIXME: This method of saving the data could potentially throw away
    # metadata from the OCR source.  Ultimately we need to merge it
    # into the old HOCR document, rather than creating a new one
    return HttpResponse(json.dumps({"ok": True}), mimetype="application/json")


@project_required
def binary(request, pid):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    if not request.is_ajax() and request.method == "POST":
        return transcript(request, pid)
    taskname = "create.docdzi"
    doc = request.project.get_storage().get(pid)
    bin = doc.binary_content
    assert bin is not None, "Binary has no content: %s" % pid
    async = OcrTask.run_celery_task(taskname, (request.project.pk, pid, "binary"),
            untracked=True,
            queue="interactive", asyncronous=request.POST.get("async", False))
    out = dict(task_id=async.task_id, status=async.status,
        results=async.result)
    return HttpResponse(json.dumps(out), mimetype="application/json")


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
def spellcheck(request):
    """
    Spellcheck some POST data.
    """
    jsondata = request.POST.get("data")
    print "Spellcheck data: %s" % jsondata
    if not jsondata:
        return HttpResponseServerError(
                "No data passed to 'spellcheck' function.")
    data = json.loads(jsondata)
    aspell = Aspell()
    response = HttpResponse(mimetype="application/json")
    json.dump(aspell.spellcheck(data), response, ensure_ascii=False)
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

