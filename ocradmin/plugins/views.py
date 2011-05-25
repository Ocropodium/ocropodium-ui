"""
RESTful interface to interacting with OCR plugins.
"""
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response

from ocradmin.ocrtasks.models import OcrTask
from ocradmin.plugins.manager import ModuleManager 

import logging
logger = logging.getLogger(__name__)

import simplejson

import tasks


def query(request):
    """
    Query plugin info.  This returns a list
    of available OCR engines and an URL that
    can be queries when one of them is selected.
    """
    stages=request.GET.getlist("stage")
    return HttpResponse(
            ModuleManager.get_json(*stages), mimetype="application/json")

def runscript(request):
    """
    Execute a script (sent as JSON).
    """
    evalnode = request.POST.get("node", "")
    jsondata = request.POST.get("script", simplejson.dumps({"arse":"spaz"}))
    script = simplejson.loads(jsondata)
    
    async = OcrTask.run_celery_task("run.script", evalnode, script,
            untracked=True, asyncronous=True, queue="interactive")
    out = dict(task_id=async.task_id, status=async.status,
        results=async.result)
    return HttpResponse(simplejson.dumps(out), mimetype="application/json")
