"""
Basic OCR functions.  Submit OCR tasks and retrieve the result.
"""

import os
from django.contrib.auth.decorators import login_required
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
from ocradmin.ocrtasks.models import OcrTask, Transcript
from ocradmin.presets.models import Preset
from ocradmin.core.decorators import project_required


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
def convert(request):
    """
    Save a posted image to the DFS and convert it with Celery.
    """
    context = dict(presets=Preset.objects.all().order_by("name"))
    return render(request, "ocr/convert.html", context)


@login_required
@saves_files
def update_ocr_task(request, task_pk):
    """
    Re-save the params for a task and resubmit it,
    redirecting to the transcript page.
    """
    raise NotImplementedError


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
    jsondata = request.POST.get("data")
    if not jsondata:
        return HttpResponseServerError("No data passed to 'save' function.")
    data = json.loads(jsondata)
    # FIXME: This method of saving the data could potentially throw away
    # metadata from the OCR source.  Ultimately we need to merge it
    # into the old HOCR document, rather than creating a new one
    result = Transcript(data=pluginutils.hocr_from_data(data), task=task)
    result.save()

    return HttpResponse(json.dumps({"ok": True}),
            mimetype="application/json")


@login_required
def task_transcript(request, task_pk):
    """
    Retrieve the results using the previously provided task name.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    pyserializer = serializers.get_serializer("python")()
    response = HttpResponse(mimetype="application/json")
    parser = ocrutils.HocrParser() 
    taskssl = pyserializer.serialize(
        [task],
        excludes=("transcripts", "args", "kwargs",),
    )
    print "HOCR OUT:", task.latest_transcript()
    out = parser.parse(task.latest_transcript())
    print "TRANSCRIPT OUT", out
    taskssl[0]["fields"]["results"] = out
    json.dump(taskssl, response,
            cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
def task_config(request, task_pk):
    """
    Get a task config as a set of key/value strings.
    """
    raise NotImplementedError
   

@project_required
@login_required
@saves_files
def submit_viewer_binarization(request, task_pk):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    taskname = "create.dzi"
    binname = "%s.bin.png" % os.path.splitext(os.path.basename(task.args[0]))[0]
    binpath = os.path.join(request.output_path, binname)
    dzipath = ocrutils.get_dzi_path(binpath)
    assert os.path.exists(binpath), "Binary path does not exist: %s" % binpath
    async = OcrTask.run_celery_task(taskname, (binpath, dzipath), untracked=True,
            queue="interactive")
    out = dict(task_id=async.task_id, status=async.status,
        results=async.result)
    return HttpResponse(json.dumps(out), mimetype="application/json")


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
    return HttpResponse(json.dumps(out), mimetype="application/json")


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


