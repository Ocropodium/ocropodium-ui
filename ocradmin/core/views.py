"""
Basic OCR functions.  Submit OCR tasks and retrieve the result.
"""

import re
import os
import traceback
from django.contrib.auth.decorators import login_required
from django.core import serializers
from django.db import transaction
from django.contrib import messages
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.core.serializers.json import DjangoJSONEncoder
from django.shortcuts import render, render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.core import tasks
from ocradmin.core import utils as ocrutils
from ocradmin.core.decorators import saves_files
from ocradmin.ocrtasks.models import OcrTask, Transcript
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.plugins.manager import PluginManager

from ocradmin.plugins import parameters

class AppException(StandardError):
    """
    Most generic app error.
    """
    pass


@login_required
def index(request):
    """
    OCR index page.
    """
    return HttpResponseRedirect("/ocr/convert/")


@login_required
@saves_files
@transaction.commit_manually
def binarize(request):
    """
        Save a posted image to the DFS.  Binarize it with Celery.
    """
    return _ocr_task(request, "ocr/binarize.html", "binarize.page")


@login_required
@saves_files
def convert(request):
    """
    Save a posted image to the DFS and convert it with Celery.
    """
    template = "ocr/convert.html"
    context = dict(presets=OcrPreset.objects.all())
    if not request.method == "POST":
        return render(request, template, context)
    return _ocr_task(request, "ocr/convert.html", "convert.page")


@login_required
@saves_files
def update_ocr_task(request, task_pk):
    """
    Re-save the params for a task and resubmit it,
    redirecting to the transcript page.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    _, config, params = _handle_request(request, request.output_path)
    task.args = (task.args[0], task.args[1], params, config)
    task.save()
    if request.is_ajax():
        return HttpResponse(simplejson.dumps({"ok": True}), 
                mimetype="application/json")
    else:
        if task.batch:
            return HttpResponseRedirect("/batch/show/%s/" % task.batch.pk)
        else:
            return HttpResponseRedirect("/ocrtasks/list/")


@login_required
def transcript(request, task_pk):
    """
    View the transcription of a task.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    template = "ocr/transcript.html"
    context = dict(task=task)
    if task.batch:
        context["batchoffset"] = task.pk - task.batch.tasks.all()[0].pk
        context["batchsize"] = task.batch.tasks.count()

    return render_to_response(template, context,
            context_instance=RequestContext(request))


@login_required
def save_transcript(request, task_pk):
    """
    Save data for a single page.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    json = request.POST.get("data")
    if not json:
        return HttpResponseServerError("No data passed to 'save' function.")
    data = simplejson.loads(json)
    result = Transcript(data=data, task=task)
    result.save()

    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")


@login_required
@saves_files
@transaction.commit_manually
def segment(request):
    """
        Save a posted image to the DFS.  Segment it with Celery.
    """
    return _ocr_task(request, "ocr/segment.html", "segment.page")


@login_required
def multiple_results(request):
    """
    Retrieve the results using the previously provided task name.
    """
    out = []
    for task_id in request.GET.getlist("job"):
        async = OcrTask.get_celery_result(task_id)
        if async is None:
            raise Http404
        out.append(_wrap_async_result(async))
    return HttpResponse(simplejson.dumps(out), mimetype="application/json")


@saves_files
@login_required
def reconvert_lines(request, task_pk):
    """
    Quick hack method for testing Tesseract line results.
    """
    jsonstr = request.POST.get("coords")
    linedata = simplejson.loads(jsonstr)

    task = get_object_or_404(OcrTask, pk=task_pk)
    _, config, params = _handle_request(request, request.output_path)
    # hack!  add an allowcache to the params dict to indicate
    # that we don't want to remake an existing binary
    import copy
    args = copy.deepcopy(task.args)
    args[2].update(dict(
            allowcache=True,
            prebinarized=True,
            write_intermediate_results=True,
            region=linedata,
            **params))
    args[3].clear()
    args[3].update(**config)
    sync = tasks.UnhandledConvertLineTask.apply(throw=True, args=args,
            queue="interactive")
    out = dict(
        task_id=sync.task_id,
        status=sync.status,
        results=sync.result
    )
    return HttpResponse(simplejson.dumps(out), mimetype="application/json")


@login_required
def results(request, task_id):
    """
    Retrieve the results using the previously provided task name.
    """
    async = OcrTask.get_celery_result(task_id)
    if async is None:
        raise Http404
    return _format_response(request, _wrap_async_result(async))


@login_required
def task_transcript(request, task_pk):
    """
    Retrieve the results using the previously provided task name.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    pyserializer = serializers.get_serializer("python")()
    response = HttpResponse(mimetype="application/json")
    taskssl = pyserializer.serialize(
        [task],
        excludes=("transcripts", "args", "kwargs",),
    )
    taskssl[0]["fields"]["results"] = task.latest_transcript()
    simplejson.dump(taskssl, response,
            cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
def task_config(request, task_pk):
    """
    Get a task config as a set of key/value strings.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    configdict = task.args[3]
    return HttpResponse(simplejson.dumps(
            parameters.OcrParameters(configdict).to_post_data()),
            mimetype="application/json")            
   

@login_required
def submit_viewer_binarization(request, task_pk):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    taskname = "binarize.page"
    # hack!  add an allowcache to the params dict to indicate
    # that we don't want to remake an existing binary
    args = task.args
    args[2]["allowcache"] = True
    async = OcrTask.run_celery_task(taskname, *args, untracked=True,
            queue="interactive")
    out = dict(task_id=async.task_id, status=async.status,
        results=async.result)
    return HttpResponse(simplejson.dumps(out), mimetype="application/json")


@login_required
def viewer_binarization_results(request, task_id):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    async = OcrTask.get_celery_result(task_id)
    out = dict(
        task_id=async.task_id,
        status=async.status,
        results=async.result
    )
    return HttpResponse(simplejson.dumps(out), mimetype="application/json")


def test(request):
    """
    Dummy action for running JS unit tests.  Probably needs to
    be put somewhere else.
    """
    return render_to_response("ocr/test.html", {})


def testparams(request):
    """
    Dummy action for running JS unit tests.  Probably needs to
    be put somewhere else.
    """

    return render_to_response("ocr/testparams.html", {})


def _ocr_task(request, template, tasktype, context={}):
    """
    Generic handler for OCR tasks which run a celery job.
    """
    if not request.method == "POST":
        return render_to_response(template, context,
                        context_instance=RequestContext(request))

    try:
        paths, config, params = _handle_request(request, request.output_path)
    except AppException, err:
        return HttpResponse(simplejson.dumps({"error": err.message}),
            mimetype="application/json")
    if not paths:
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")

    # init the job from our params
    asynctasks = []
    for path in paths:
        tid = OcrTask.get_new_task_id()
        args = (path.encode(), request.output_path.encode(), params, config)
        kwargs = dict(task_id=tid, loglevel=60, retries=2, queue="interactive")
        ocrtask = OcrTask(
            task_id=tid,
            user=request.user,
            page_name=os.path.basename(path),
            task_name=tasktype,
            status="INIT",
            args=args,
            kwargs=kwargs,
        )
        ocrtask.save()
        asynctasks.append(ocrtask)
    try:
        # aggregate the results.  If necessary wait for tasks.
        out = []
        for task in asynctasks:
            res = task.run(asyncronous=not _should_wait(request))
            out.append({
                "page_name": task.page_name,
                "task_id": task.task_id,
                "status": res.status,
                "results": res.result,
            })
        # should be past the danger zone now...
        transaction.commit()
        return _format_response(request, out)
    except StandardError, err:
        transaction.rollback()
        return HttpResponse(
            simplejson.dumps({
                "error": err.message,
                "trace": "\n".join(
                    ["\t".join(str(t)) for t in traceback.extract_stack()]
                )
            }),
            mimetype="application/json"
        )


def _wrap_async_result(async):
    """
    Convert an async object into suitable JSON.
    """
    if async.status == "FAILURE":
        err = async.result
        taskmeta = OcrTask.objects.get(task_id=async.task_id)
        return dict(
            task_id=async.task_id,
            status=async.status,
            results=None,
            error=err.message,
            trace=taskmeta.traceback
        )
    return dict(
        task_id=async.task_id,
        status=async.status,
        results=async.result
    )


def _wants_text_format(request):
    """
    Determine whether we should send back plain text instead of JSON.
    """
    return request.META.get("HTTP_ACCEPT", "") == "text/plain" \
        or request.GET.get("format", "") == "text" \
        or request.POST.get("format", "") == "text"


def _wants_hocr_format(request):
    """
    Determine whether we should send back HOCR.
    """
    return request.GET.get("format", "") == "hocr" \
        or request.POST.get("format", "") == "hocr"


def _wants_png_format(request):
    """
    Determine whether to send back an image rather than JSON.
    (For binarisation/segmentation.
    """
    return (request.META.get("HTTP_ACCEPT", "") == "image/png" \
        or request.GET.get("format", "") == "png" \
        or request.POST.get("format", "") == "png")


def _should_wait(request):
    """
    Determine if we should block waiting for the results.  The
    default is to not block.
    """
    return request.GET.get("wait", False)


def _format_data(request, json):
    """
    Format the output string accordingly.
    """
    if _wants_png_format(request):
        if isinstance(json, dict):
            json = [json]
        mimetype = "image/png"
        try:
            path = ocrutils.media_url_to_path(
                    json[0]["results"]["out"])
            result = open(path, "rb").read()
        except (IndexError, KeyError), err:
            result = ""
            raise err
    elif _wants_text_format(request):
        if isinstance(json, dict):
            json = [json]
        mimetype = "text/plain"
        result = ""
        for page in json:
            if page.get("results"):
                result += ocrutils.output_to_text(page.get("results"))
                result += "\n"
    elif _wants_hocr_format(request):
        if isinstance(json, dict):
            json = [json]
        mimetype = "text/html"
        result = ""
        for page in json:
            if page.get("results"):
                result += ocrutils.output_to_text(page.get("results"))
                result += "\n"
    else:
        mimetype = "application/json"
        result = simplejson.dumps(json)
    return result, mimetype


def _format_response(request, json):
    """
    Return the appropriate mimetype
    """
    result, mimetype = _format_data(request, json)
    return HttpResponse(result, mimetype=mimetype)


def _handle_request(request, outdir):
    """
    Save files and extract parameters.  How this happens
    depends on how the file was send - either multipart
    of as the whole POST body.
    """

    if request.GET.get("inlinefile"):
        return _handle_streaming_upload(request, outdir)
    else:
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
    config = parameters.parse_post_data(request.GET)
    return [fpath], config, _cleanup_params(request.GET)


def _handle_multipart_upload(request, outdir):
    """
    Handle an upload where the file data is multipart
    encoded in the POST body, along with the params.
    """
    if request.POST.get("png"):
        paths = [ocrutils.media_url_to_path(request.POST.get("png"))]
    else:
        paths = ocrutils.save_ocr_images(request.FILES.iteritems(), outdir)
    config = parameters.parse_post_data(request.POST)
    return paths, config, _cleanup_params(request.POST)


def _cleanup_params(data):
    """
    Remove OCR-type params.
    """
    cleaned = {}
    for k, v in data.iteritems():
        if not k.startswith(("$","%","@")):
            cleaned[k] = v
    return cleaned            


