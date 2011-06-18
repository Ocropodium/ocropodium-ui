"""
Batch-related views.
"""

import os
from types import MethodType
import tarfile
import StringIO

from django import forms
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core import serializers
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.core.serializers.json import DjangoJSONEncoder
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Count
from django.http import HttpResponse, HttpResponseRedirect, \
        HttpResponseServerError
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from django.utils.encoding import smart_str
from ocradmin.batch import utils as batchutils
from ocradmin.core import utils as ocrutils
from ocradmin.core.decorators import project_required, saves_files
from ocradmin.ocrtasks.models import OcrTask, Batch
from ocradmin.core.views import AppException
from ocradmin.presets.models import Preset


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
                not key in Batch._meta.get_all_field_names():
            continue
        if not val:
            continue
        query = query & Q(**{str(key): str(val)})
    query = Batch.objects.select_related().filter(query)
    if order and order[0].replace("-", "", 1) == "task_count":
        query = query.annotate(task_count=Count("tasks"))
    return query.order_by(*order)


class BatchForm(forms.ModelForm):
    """
        New project form.
    """
    def __init__(self, *args, **kwargs):
        super(forms.ModelForm, self).__init__(*args, **kwargs)

        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40

    class Meta:
        model = Batch
        exclude = ["user", "created_on", "project", "task_type"]
        widgets = dict(
                user=forms.HiddenInput(),
        )


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
def batch_list(request):
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
@transaction.commit_on_success
def create(request):
    """
    Create a batch from pre-saved images convert them asyncronously.
    """
    taskname = "run.batchitem"

    # get the subject file paths from comma seperated POST data
    paths = _get_batch_file_paths(request)
    script = request.POST.get("script")
    if not script and request.POST.get("preset") is not None:
        try:
            script = Preset.objects.get(pk=request.POST.get("preset")).data
        except Preset.DoesNotExist:
            print "PRESET %d not found" % request.POST.get("preset")
            pass

    form = BatchForm(request.POST)
    if not request.method == "POST" or not form.is_valid() or not paths or not script:
        return render_to_response("batch/new.html",
            _new_batch_context(request),
            context_instance=RequestContext(request))

    # create a batch db job
    # TODO: catch potential integrity error for a duplicate
    # batch name within the given project
    batch = Batch(
        user=request.user,
        name=form.cleaned_data["name"],
        description=form.cleaned_data["description"],
        tags=form.cleaned_data["tags"],
        task_type=taskname,
        project=request.session["project"]
    )
    batch.save()

    ocrtasks = []
    options = dict(loglevel=60, retries=2)
    for path in paths:
        tid = OcrTask.get_new_task_id()
        args = (path, script, request.output_path)
        kwargs = dict()
        ocrtask = OcrTask(
            task_id=tid,
            user=request.user,
            batch=batch,
            project=request.session["project"],
            page_name=os.path.basename(path),
            task_name=taskname,
            status="INIT",
            args=args,
            kwargs=kwargs,
        )
        ocrtask.save()
        ocrtasks.append(ocrtask)
    try:
        # ignoring the result for now
        OcrTask.run_celery_task_multiple(taskname, ocrtasks, **options)
    except StandardError:
        transaction.rollback()
        raise
    transaction.commit()
    return HttpResponseRedirect("/batch/show/%s/" % batch.pk)


@login_required
def results(request, batch_pk):
    """
    Get results for a taskset.
    """
    batch = get_object_or_404(Batch, pk=batch_pk)
    try:
        start = max(0, int(request.GET.get("start", 0)))
    except ValueError:
        start = 0
    try:
        limit = max(1, int(request.GET.get("limit", 25)))
    except ValueError:
        limit = 25
    statuses = request.GET.getlist("status")
    name = request.GET.get("name")
    if "ALL" in statuses:
        statuses = None
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch, start, limit, statuses, name),
            response, cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
def page_results(request, batch_pk, page_index):
    """
    Get the results for a single page.
    """
    batch = get_object_or_404(Batch, pk=batch_pk)
    try:
        page = batch.tasks.all().order_by("page_name")[int(page_index)]
    except Batch.DoesNotExist:
        raise

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
@project_required
def latest(request):
    """
    View the latest batch.
    """
    try:
        batch = Batch.objects.filter(
            user=request.user,
            project=request.session["project"]
        ).order_by("-created_on")[0]
    except (Batch.DoesNotExist, IndexError):
        batch = None

    return _show_batch(request, batch)


@login_required
@project_required
def show(request, batch_pk):
    """
    View a batch.
    """
    batch = get_object_or_404(
        Batch,
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
        paths = _handle_upload(request, request.output_path)
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
    batch = get_object_or_404(Batch, pk=batch_pk)
    tid = batch.tasks.all()[0]
    return HttpResponseRedirect("/ocr/transcript/%d/" % tid.pk)


def _show_batch(request, batch):
    """
    View a (passed-in) batch.
    """
    template = "batch/show.html" if not request.is_ajax() \
            else "batch/includes/show_batch.html"
    context = {"batch": batch}
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.commit_on_success
@login_required
def abort_batch(request, batch_pk):
    """
    Abort an entire batch.
    """
    batch = get_object_or_404(Batch, pk=batch_pk)
    for task in batch.tasks.all():
        task.abort()
    transaction.commit()
    if request.is_ajax():
        return HttpResponse(simplejson.dumps({"ok": True}),
                mimetype="application/json")
    else:
        return HttpResponseRedirect("/batch/show/%s/" % batch_pk)


@transaction.commit_on_success
@login_required
def retry(request, batch_pk):
    """
    Retry all tasks in a batch.
    """
    batch = get_object_or_404(Batch, pk=batch_pk)
    for task in batch.tasks.all():
        task.retry()
    transaction.commit()
    if request.is_ajax():
        return HttpResponse(simplejson.dumps({"ok": True}),
                mimetype="application/json")
    else:
        return HttpResponseRedirect("/batch/show/%s/" % batch_pk)


@transaction.commit_on_success
@login_required
def retry_errored(request, batch_pk):
    """
    Retry all errored tasks in a batch.
    """
    batch = get_object_or_404(Batch, pk=batch_pk)
    for task in batch.errored_tasks():
        task.retry()
    transaction.commit()
    if request.is_ajax():
        return HttpResponse(simplejson.dumps({"ok": True}),
                mimetype="application/json")
    else:
        return HttpResponseRedirect("/batch/show/%s/" % batch_pk)


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
    batch = get_object_or_404(Batch, pk=batch_pk)
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
    batch = get_object_or_404(Batch, pk=batch_pk)
    formats = {"text": "txt", "json": "json", "hocr": "html"}
    reqformats = request.GET.getlist("format")
    if not reqformats:
        reqformats = ["hocr"]

    #temp = tempfile.TemporaryFile()
    response = HttpResponse(content_type="application/x-gzip")
    tar = tarfile.open(fileobj=response, mode='w|gz')
    for task in batch.tasks.all():
        json = task.latest_transcript()
        for fmt, ext in formats.iteritems():
            if not fmt in reqformats:
                continue
            output = getattr(ocrutils, "output_to_%s" % fmt)(json)
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
    batch = get_object_or_404(Batch, pk=batch_pk)
    if request.user != batch.user:
        messages.warning(request,
                "Unable to delete batch '%s': Permission denied" % batch.name)
        return HttpResponseRedirect
    batch.delete()
    return HttpResponseRedirect("/batch/list/")


def _serialize_batch(batch, start=0, limit=25, statuses=None, name=None):
    """
    Hack around the problem of serializing
    an object AND it's child objects.
    """
    taskqset = batch.tasks.all()
    if statuses:
        taskqset = batch.tasks.filter(status__in=statuses)
    if name:
        taskqset = taskqset.filter(page_name__icontains=name)    
    task_count = taskqset.count()
    pyserializer = serializers.get_serializer("python")()
    batchsl = pyserializer.serialize(
        [batch],
        extras=("estimate_progress", "is_complete",),
        relations={
            "user": {"fields": ("username")},
            "comparison": {"fields": ()},
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
            project.batches.count() + 1)
    form = BatchForm(initial=dict(name=batchname, user=request.user))
    presets = Preset.objects.all().order_by("name")
    return dict(
        prefix="",
        form=form,
        presets=presets,
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


def _handle_upload(request, outdir):
    """
    Save files and extract parameters.  How this happens
    depends on how the file was send - either multipart
    of as the whole POST body.
    """

    if request.GET.get("inlinefile"):
        return _handle_streaming_upload(request, outdir)
    return _handle_multipart_upload(request, outdir)


def _handle_streaming_upload(request, outdir):
    """
    Handle an upload where the params are in GET and
    the whole of the POST body consists of the file.
    """
    fpath = os.path.join(outdir, request.GET.get("inlinefile"))
    if not os.path.exists(outdir):
        os.makedirs(outdir, 0777)
    tmpfile = file(fpath, "wb")
    tmpfile.write(request.raw_post_data)
    tmpfile.close()
    return [fpath]


def _handle_multipart_upload(request, outdir):
    """
    Handle an upload where the file data is multipart
    encoded in the POST body, along with the params.
    """
    if request.POST.get("png"):
        paths = [ocrutils.media_url_to_path(request.POST.get("png"))]
    else:
        paths = ocrutils.save_ocr_images(request.FILES.iteritems(), outdir)
    return paths
