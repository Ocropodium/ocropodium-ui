"""
Basic OCR functions.  Submit OCR tasks and retrieve the result.
"""

import os
from django.core import serializers
from django.http import HttpResponse, HttpResponseRedirect, \
        HttpResponseServerError
from django.core.serializers.json import DjangoJSONEncoder
from django.shortcuts import render, render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson as json
from ocradmin.core import utils as ocrutils
from ocradmin.plugins import utils as pluginutils
from ocradmin.core.decorators import saves_files
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.transcripts.models import Transcript
from ocradmin.presets.models import Preset
from ocradmin.core.decorators import project_required


class AppException(StandardError):
    """
    Most generic app error.
    """
    pass


def index(request):
    """
    OCR index page.
    """
    return HttpResponseRedirect("/presets/builder/")


@saves_files
def update_ocr_task(request, task_pk):
    """
    Re-save the params for a task and resubmit it,
    redirecting to the transcript page.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    script = request.POST.get("script")
    ref = request.POST.get("ref", "/batch/show/%d/" % task.batch.pk)
    print "UPDATING WITH REF: %s" % ref
    try:
        json.loads(script)
        task.args = (task.args[0], script, task.args[2])
        task.save()
        task.retry()
    except ValueError:
        pass
    return HttpResponseRedirect(ref)


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


def save_transcript(request, task_pk):
    """
    Save data for a single page.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    data = request.POST.get("data")
    if not data:
        return HttpResponseServerError("No data passed to 'save' function.")
    from BeautifulSoup import BeautifulSoup
    soup = BeautifulSoup(task.latest_transcript())
    soup.find("div", {"class": "ocr_page"}).replaceWith(data)
    print "REPLACED"
    # FIXME: This method of saving the data could potentially throw away
    # metadata from the OCR source.  Ultimately we need to merge it
    # into the old HOCR document, rather than creating a new one
    result = Transcript(data=str(soup), task=task)
    result.save()
    return HttpResponse(json.dumps({"ok": True}),
            mimetype="application/json")


def task_transcript(request, task_pk):
    """
    Retrieve the results using the previously provided task name.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    return HttpResponse(task.latest_transcript())


def task_config(request, task_pk):
    """
    Get a task config as a set of key/value strings.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    path, script, outdir = task.args
    return HttpResponse(script, mimetype="application/json")


@project_required
@saves_files
def submit_viewer_binarization(request, task_pk):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    taskname = "create.dzi"
    binpath = ocrutils.get_binary_path(task.args[0], request.output_path)
    dzipath = ocrutils.get_dzi_path(binpath)
    assert os.path.exists(binpath), "Binary path does not exist: %s" % binpath
    async = OcrTask.run_celery_task(taskname, (binpath, dzipath), untracked=True,
            queue="interactive", asyncronous=True)
    out = dict(task_id=async.task_id, status=async.status,
        results=async.result)
    return HttpResponse(json.dumps(out), mimetype="application/json")


def result(request, task_id):
    """
    Fetch the result for one Celery task id.
    """
    async = OcrTask.get_celery_result(task_id)
    out = dict(
        task_id=async.task_id,
        status=async.status,
        results=async.result
    )
    response = HttpResponse(mimetype="application/json")
    json.dump(out, response, ensure_ascii=False)
    return response


def results(request, task_ids):
    """
    Fetch the results of several Celery task ids.
    """
    out = []
    for task_id in task_ids.split(","):
        async = OcrTask.get_celery_result(task_id)
        out.append(dict(
            result=_flatten_result(async.result),
            task_id=task_id,
            status=async.status,
        ))
    response = HttpResponse(mimetype="application/json")
    json.dump(out, response, ensure_ascii=False)
    return response


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


def _flatten_result(result):
    """
    Ensure we can serialize a celery result.
    """
    if issubclass(type(result), Exception):
        return result.message
    else:
        return result



