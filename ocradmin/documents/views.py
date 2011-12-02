"""
Views for handling documents and document storage.
"""

import json
from django import forms
from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect, \
            HttpResponseServerError, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from ocradmin import storage
from ocradmin.storage.utils import DocumentEncoder
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

import logging

# Get an instance of a logger
logger = logging.getLogger(__name__)

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
def editor(request, pid):
    """Edit document transcript."""
    storage = request.project.get_storage()
    doc = storage.get(pid)    
    context = dict(
            next=storage.next(pid),
            prev=storage.prev(pid),
            doc=doc)
    if not request.is_ajax():
        template = "documents/editor.html"
        return render(request, template, context)
    # if it's an Ajax request, write the document text to the
    # response
    response = HttpResponse(mimetype="application/json")
    json.dump(context, response, cls=DocumentEncoder)
    return response


@project_required
def transcript(request, pid):
    """Get/set the transcript for a document."""
    doc = request.project.get_storage().get(pid)
    if not request.method == "POST":
        response = HttpResponse(mimetype=doc.transcript_mimetype)
        with doc.transcript_content as handle:
            response.write(handle.read())
        return response

    # FIXME: This method of saving the data could potentially throw away
    # metadata from the OCR source.  Ultimately we need to merge it
    # into the old HOCR document, rather than creating a new one
    data = request.POST.get("data")
    if not data:
        return HttpResponseServerError("No data passed to 'save' function.")
    with doc.transcript_content as handle:
        soup = BeautifulSoup(handle)
    soup.find("div", {"class": "ocr_page"}).replaceWith(data)
    doc.transcript_content = str(soup)
    doc.save()
    return HttpResponse(json.dumps({"ok": True}), mimetype="application/json")


@project_required
def binary(request, pid):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    taskname = "create.docdzi"
    doc = request.project.get_storage().get(pid)
    if not request.is_ajax():
        response = HttpResponse(mimetype=doc.binary_mimetype)
        with doc.binary_content as handle:
            response.write(handle.read())
        return response
    
    if doc.binary_empty:
        return HttpResponseNotFound
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
        doc.set_metadata(title=form.cleaned_data["label"], ocr_status="initial")
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
    print "creating doc"
    if request.method == "POST" and request.GET.get("inlinefile"):
        try:
            filename = request.GET.get("inlinefile")
            doc = store.create_document(filename)
            doc.image_content = StringIO(request.raw_post_data)
            doc.image_mimetype = request.META.get("HTTP_X_FILE_TYPE")
            doc.image_label = filename
            doc.set_metadata(title=filename, ocr_status="initial")
            doc.make_thumbnail()
            doc.save()
            pid = doc.pid
        except Exception, err:
            logger.exception(err)

    print "Rendering response"
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
    storage = request.project.get_storage()
    doc = storage.get(pid)
    return render(request, "document/details.html", dict(object=doc))


@project_required
def delete(request, pid):
    storage = request.project.get_storage()
    doc = storage.get(pid)
    return render(request, "document/delete.html", dict(object=doc))

@project_required
def delete_multiple(request):
    # fixme, figure out how to do the post
    # properly
    if request.method == "POST":
        pids = request.GET.getlist("pid");
        storage = request.project.get_storage()
        print "Deleting %s" % pids
        [storage.get(pid).delete() for pid in pids]
        if request.is_ajax():
            return HttpResponse(json.dumps({"ok": True}), 
                    mimetype="application/json")
        return render(request, "document/delete.html", dict(object=doc))



