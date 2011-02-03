import os
from types import MethodType
import tempfile
import gzip
import tarfile
import StringIO

from celery import result as celeryresult
from datetime import datetime
from django import forms
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core import serializers
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.core.serializers.json import DjangoJSONEncoder
from django.core.servers.basehttp import FileWrapper
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Count
from django.http import HttpResponse, HttpResponseRedirect, \
        HttpResponseServerError
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from django.utils.encoding import smart_str, smart_unicode
from ocradmin.batch import utils as batchutils
from ocradmin.ocr import tasks
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocr.utils import saves_files
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.ocrtasks.models import OcrTask, OcrBatch, Transcript
from ocradmin.projects.tasks import IngestTask
from ocradmin.training.tasks import ComparisonTask
from ocradmin.projects.utils import project_required
from ocradmin.ocr.views import _get_best_params, _cleanup_params
from ocradmin.ocr.views import _handle_request, AppException
from ocradmin.ocr.views import  _retry_celery_task, _abort_celery_task 
from ocradmin.ocr.tools.manager import PluginManager


PER_PAGE = 25


def batch_query(params):
    """
    Query the batch db.
    """
    order = [x for x in params.getlist("order_by") if x != ""] \
            or ["created_on"]

    query = Q()
    for key, val in params.items():
        if key.find("__") == -1 and \
                not key in OcrBatch._meta.get_all_field_names():
            continue
        if not val:
            continue
        query = query & Q(**{str(key): str(val)})
    query = OcrBatch.objects.select_related().filter(query)
    if order and order[0].replace("-", "", 1) == "task_count":
        query = query.annotate(task_count=Count("tasks"))
    return query.order_by(*order)


class OcrBatchForm(forms.ModelForm):
    """
        New project form.
    """
    def __init__(self, *args, **kwargs):
        super(forms.ModelForm, self).__init__(*args, **kwargs)

        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40

    class Meta:
        model = OcrBatch
        exclude = ["user", "created_on", "project", "task_type"]


@login_required
@project_required
def new(request):
    """
    Present a new batch form.
    """
    template = "batch/new.html" if not request.is_ajax() \
        else "batch/includes/new_form.html"
    return render_to_response(template, _new_batch_context(request),
            context_instance=RequestContext(request))


@login_required
@project_required
def list(request):
    """
    List recent batches.
    """
    params = request.GET.copy()
    params["project"] = request.session["project"].pk
    context = dict(params=params)
    if not request.is_ajax():
        return render_to_response("batch/list.html", context,
                context_instance=RequestContext(request))

    paginator = Paginator(batch_query(params), PER_PAGE)
    try:
        page = int(request.GET.get('page', '1'))
    except ValueError:
        page = 1

    try:
        batches = paginator.page(page)
    except (EmptyPage, InvalidPage):
        batches = paginator.page(paginator.num_pages)

    pythonserializer = serializers.get_serializer("python")()
    serializedpage = {}
    serializedpage["num_pages"] = paginator.num_pages
    wanted = ("end_index", "has_next", "has_other_pages", "has_previous",
            "next_page_number", "number",
            "start_index", "previous_page_number")
    for attr in wanted:
        want = getattr(batches, attr)
        if isinstance(want, MethodType):
            serializedpage[attr] = want()
        elif isinstance(want, (str, int)):
            serializedpage[attr] = want
    # This gets rather gnarly, see:
    # http://code.google.com/p/wadofstuff/wiki/DjangoFullSerializers
    serializedpage["params"] = params
    serializedpage["object_list"] = pythonserializer.serialize(
        batches.object_list,
        extras=("username", "is_complete", "task_count",),
    )

    response = HttpResponse(mimetype="application/json")
    simplejson.dump(serializedpage, response,
            cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
@project_required
@saves_files
@transaction.commit_manually
def create(request):
    """
    Create a batch from pre-saved images convert them with Celery.
    """

    celerytask = tasks.ConvertPageTask

    # get the subject file paths from comma seperated POST data
    paths = _get_batch_file_paths(request)
    form = OcrBatchForm(request.POST)
    if not request.method == "POST" or not form.is_valid() or not paths:
        return render_to_response("batch/new.html",
            _new_batch_context(request),
            context_instance=RequestContext(request))

    # create a batch db job
    # TODO: catch potential integrity error for a duplicate
    # batch name within the given project
    batch = OcrBatch(
        user=request.user,
        name=form.cleaned_data["name"],
        description=form.cleaned_data["description"],
        tags=form.cleaned_data["tags"],
        task_type=celerytask.name,
        project=request.session["project"]
    )
    batch.save()

    # wrangle the params - this needs improving
    userparams = _get_best_params(
            _cleanup_params(request.POST.copy(),
                ("files", "name", "description", "tags")))
    # preserve intermediate binary & segmentation results            
    userparams["write_intermediate_results"] = True
    asyncparams = []
    try:
        for path in paths:
            tid = ocrutils.get_new_task_id()
            args = (path.encode(), request.output_path.encode(), userparams)
            kwargs = dict(task_id=tid, loglevel=60, retries=2)
            ocrtask = OcrTask(
                task_id=tid,
                user=request.user,
                batch=batch,
                project=request.session["project"],
                page_name=os.path.basename(path),
                task_name=celerytask.name,
                status="INIT",
                args=args,
                kwargs=kwargs,
            )
            ocrtask.save()
            asyncparams.append((args, kwargs))

        publisher = celerytask.get_publisher(connect_timeout=5)
        try:
            for args, kwargs in asyncparams:
                celerytask.apply_async(args=args,
                        publisher=publisher, **kwargs)
        finally:
            publisher.close()
            publisher.connection.close()

    except Exception, err:
        transaction.rollback()
        print err.message
        return HttpResponse(err.message, mimetype="application/json")

    # return a serialized result
    transaction.commit()
    return HttpResponseRedirect("/batch/show/%s/" % batch.pk)


@login_required
def results(request, batch_pk):
    """
    Get results for a taskset.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    try:
        start = max(0, int(request.GET.get("start", 0)))
    except ValueError:
        start = 0
    try:
        limit = max(1, int(request.GET.get("limit", 25)))
    except ValueError:
        limit = 25
    statuses = request.GET.getlist("status")
    if "ALL" in statuses:
        statuses = None
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch, start, limit, statuses),
            response, cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
def page_results(request, batch_pk, page_index):
    """
    Get the results for a single page.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    try:
        page = batch.tasks.all().order_by("page_name")[int(page_index)]
    except OcrBatch.DoesNotExist, err:
        raise err

    pyserializer = serializers.get_serializer("python")()
    response = HttpResponse(mimetype="application/json")
    taskssl = pyserializer.serialize(
        [page],
        excludes=("transcripts", "args", "kwargs",),
    )
    taskssl[0]["fields"]["results"] = page.latest_transcript()
    simplejson.dump(taskssl, response,
            cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
def save_page_data(request, batch_pk, page_index):
    """
    Save data for a single page.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    try:
        page = batch.tasks.all().order_by("page_name")[int(page_index)]
    except OcrBatch.DoesNotExist, err:
        raise err

    json = request.POST.get("data")
    if not json:
        return HttpResponseServerError("No data passed to 'save' function.")
    data = simplejson.loads(json)
    result = Transcript(data=data, task=page)
    result.save()

    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")


@login_required
def reconvert_results(request):
    """
    Get results of a batch of reconvert tasks.
    """
    pass


@login_required
@project_required
def latest(request):
    """
    View the latest batch.
    """
    try:
        batch = OcrBatch.objects.filter(
            user=request.user,
            project=request.session["project"]
        ).order_by("-created_on")[0]
    except (OcrBatch.DoesNotExist, IndexError):
        batch = None

    return _show_batch(request, batch)


@login_required
def show(request, batch_pk):
    """
    View a batch.
    """
    batch = get_object_or_404(
        OcrBatch,
        pk=batch_pk,
        project=request.session["project"]
    )
    return _show_batch(request, batch)


@login_required
@project_required
@saves_files
def upload_files(request):
    """
    Upload files to the server for batch-processing.
    """
    mimetype = "application/json" if not request.POST.get("_iframe") \
            else "text/html"
    relpath = request.session["project"].slug
    try:
        paths = _handle_request(request, request.output_path)[0]
    except AppException, err:
        return HttpResponse(simplejson.dumps({"error": err.message}),
            mimetype="application/json")
    if not paths:
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")

    pathlist = [os.path.join(relpath, os.path.basename(p)) for p in paths]
    return HttpResponse(simplejson.dumps(pathlist), mimetype=mimetype)


@login_required
@project_required
def transcript(request, batch_pk):
    """
    View the transcription of a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    template = "batch/transcript.html"
    context = dict(batch=batch, initial=request.GET.get("page"))

    return render_to_response(template, context,
            context_instance=RequestContext(request))


def _show_batch(request, batch):
    """
    View a (passed-in) batch.
    """
    template = "batch/show.html"
    context = {"batch": batch}

    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.commit_manually
@login_required
def abort_batch(request, batch_pk):
    """
    Abort an entire batch.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    for task in batch.tasks.all():
        _abort_celery_task(task)
    transaction.commit()
    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")


@transaction.commit_manually
@login_required
def retry(request, batch_pk):
    """
    Retry all tasks in a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    for task in batch.tasks.all():
        _retry_celery_task(task)
    transaction.commit()
    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")


@transaction.commit_manually
@login_required
def retry_errored(request, batch_pk):
    """
    Retry all errored tasks in a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    for task in batch.errored_tasks():
        _retry_celery_task(task)
    transaction.commit()
    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")


def test(request):
    """
    Test action
    """
    return render_to_response("batch/test.html",
            {}, context_instance=RequestContext(request))


@login_required
def export_options(request, batch_pk):
    """
    Setup export.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    formats = {"text": "Plain Text", "json": "JSON", "hocr": "HOCR HTML"}
    template = "batch/export_options.html" if not request.is_ajax() \
            else "batch/includes/export_form.html"
    context = dict(
        batch=batch,
        formats=formats
    )
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@login_required
def export(request, batch_pk):
    """
    Export a batch as HOCR.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    formats = {"text": "txt", "json": "json", "hocr": "html"}
    reqformats = request.GET.getlist("format")
    if not reqformats:
        reqformats = ["hocr"]

    #temp = tempfile.TemporaryFile()
    response = HttpResponse(content_type="application/x-gzip")
    tar = tarfile.open(fileobj=response, mode='w|gz')
    for task in batch.tasks.all():
        json = task.latest_transcript()
        for format, ext in formats.iteritems():
            if not format in reqformats:
                continue
            output = getattr(ocrutils, "output_to_%s" % format)(json)
            info = tarfile.TarInfo(
                    "%s.%s" % (os.path.splitext(task.page_name)[0], ext))
            info.size = len(output)
            buf = StringIO.StringIO(smart_str(output))
            tar.addfile(info, buf)
    tar.close()
    response["Content-Disposition"] = \
            "attachment: filename=%s.tar.gz" % batch.name
    return response


@login_required
def spellcheck(request):
    """
    Spellcheck some POST data.
    """
    json = request.POST.get("data")
    if not json:
        return HttpResponseServerError(
                "No data passed to 'spellcheck' function.")
    data = simplejson.loads(json)
    aspell = batchutils.Aspell()
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(aspell.spellcheck(data), response, ensure_ascii=False)
    return response


@login_required
def delete(request, batch_pk):
    """
    Delete a batch and all tasks belonging to it.
    """
    batch = get_object_or_404(OcrBatch, pk=batch_pk)
    if request.user != batch.user:
        messages.warning(request,
                "Unable to delete batch '%s': Permission denied" % batch.name)
        return HttpResponseRedirect
    batch.delete()
    return HttpResponseRedirect("/batch/list/")


def _serialize_batch(batch, start=0, limit=25, statuses=None):
    """
    Hack around the problem of serializing
    an object AND it's child objects.
    """
    if statuses:
        taskqset = batch.tasks.filter(status__in=statuses)
    else:
        taskqset = batch.tasks.all()
    task_count = taskqset.count()
    pyserializer = serializers.get_serializer("python")()
    batchsl = pyserializer.serialize(
        [batch],
        extras=("estimate_progress", "is_complete",),
        relations={
            "user": {"fields": ("username")},
            "ocrcomparison": {"fields": ()},
        },
    )
    taskssl = pyserializer.serialize(
        taskqset.order_by("page_name")[start:start + limit],
        excludes=("args", "kwargs", "traceback",),
    )
    batchsl[0]["fields"]["tasks"] = taskssl
    batchsl[0]["extras"]["task_count"] = task_count
    return batchsl


def _new_batch_context(request):
    """
    Template variables for a new batch form.
    """
    # add available seg and bin presets to the context
    # work out the name of the batch - start with how
    # many other batches there are in the projects
    project = request.session["project"]
    batchname = "%s - Batch %d" % (project.name,
            project.ocrbatch_set.count() + 1)
    form = OcrBatchForm(initial={"name": batchname})
    return dict(
        prefix="",
        form=form,
        engines=PluginManager.get_provider("line"),
        binpresets=OcrPreset.objects.filter(type="binarize").order_by("name"),
        segpresets=OcrPreset.objects.filter(type="segment").order_by("name"),
    )


def _get_batch_file_paths(request):
    """
    Extract the full file paths from the POST data.
    """
    dirpath = os.path.relpath(os.path.join(
        settings.MEDIA_ROOT,
        settings.USER_FILES_PATH
    ))
    filenames = request.POST.get("files", "").split(",")
    return [os.path.join(dirpath, f) for f in sorted(filenames)]
