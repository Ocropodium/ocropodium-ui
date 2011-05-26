"""
RESTful interface to interacting with OCR plugins.
"""
import os
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response

from ocradmin.ocrtasks.models import OcrTask
from ocradmin.plugins.manager import ModuleManager 
from ocradmin.core.decorators import saves_files

import logging
logger = logging.getLogger(__name__)

import simplejson

import tasks

import numpy


def query(request):
    """
    Query plugin info.  This returns a list
    of available OCR engines and an URL that
    can be queries when one of them is selected.
    """
    stages=request.GET.getlist("stage")
    return HttpResponse(
            ModuleManager.get_json(*stages), mimetype="application/json")

@saves_files
def runscript(request):
    """
    Execute a script (sent as JSON).
    """
    evalnode = request.POST.get("node", "")
    jsondata = request.POST.get("script", simplejson.dumps({"arse":"spaz"}))
    script = simplejson.loads(jsondata)
    
    async = OcrTask.run_celery_task("run.script", evalnode, script,
            request.output_path, untracked=True,
            asyncronous=True, queue="interactive")
    out = dict(
        node=evalnode,
        task_id=async.task_id,
        status=async.status,
        results=async.result
    )
    return HttpResponse(simplejson.dumps(out), mimetype="application/json")


def results(request, task_ids):
    """
    Fetch the results of several Celery task ids.
    """
    results = []
    for task_id in task_ids.split(","):
        async = OcrTask.get_celery_result(task_id)
        results.append(dict(
            result=async.result,
            task_id=task_id,
            status=async.status,            
        ))

    return HttpResponse(simplejson.dumps(results), mimetype="application/json")


@saves_files
def upload_file(request):
    """
    Upload a temp file.
    """
    import os
    fpath = os.path.join(request.output_path, 
            request.GET.get("inlinefile"))
    if not os.path.exists(request.output_path):
        os.makedirs(request.output_path, 0777)
    tmpfile = file(fpath, "wb")
    tmpfile.write(request.raw_post_data)
    tmpfile.close()

    return HttpResponse(simplejson.dumps(dict(
        file=fpath,
    )), mimetype="application/json")



