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
from django.views.decorators.csrf import csrf_exempt
from ocradmin.core import utils as ocrutils
from ocradmin.nodelib import utils as pluginutils
from ocradmin.core.decorators import saves_files, project_required
from ocradmin.ocrtasks.models import OcrTask
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


def abort(request, task_id):
    """
    Kill a running celery task.
    """
    OcrTask.revoke_celery_task(task_id, kill=True)
    out = dict(
        task_id=task_id,
        status="ABORT"
    )
    response = HttpResponse(mimetype="application/json")
    json.dump(out, response, ensure_ascii=False)
    return response

@csrf_exempt
@saves_files
def update_ocr_task(request, task_pk):
    """
    Re-save the params for a task and resubmit it,
    redirecting to the transcript page.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    script = request.POST.get("script")
    # try and delete the existing binary path
    binpath = ocrutils.get_binary_path(task.args[0], request.output_path)
    dzipath = ocrutils.get_dzi_path(binpath)
    try:
        os.unlink(dzipath)
    except OSError:
        pass
    ref = request.POST.get("ref", "/batch/show/%d/" % task.batch.pk)
    try:
        json.loads(script)
        task.args = (task.args[0], script, task.args[2])
        task.save()
        task.retry()
    except ValueError:
        pass
    return HttpResponseRedirect(ref)


def task_config(request, task_pk):
    """
    Get a task config as a set of key/value strings.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    path, script, outdir = task.args
    return HttpResponse(script, mimetype="application/json")


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



