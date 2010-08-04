# Create your views here.


import re
import os
import traceback
from datetime import datetime
from celery import result as celeryresult
from celery.task.sets import TaskSet, subtask
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.core import serializers
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.ocr import tasks
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.ocrtasks.models import OcrTask, OcrBatch 


from ocradmin.ocr.views import _get_best_params


@login_required
@transaction.commit_manually
def batch(request):
    """
    Save a batch of posted image to the DFS and convert them with Celery.
    """

    # add available seg and bin presets to the context
    context = {
        "binpresets": OcrPreset.objects.filter(
            type="binarize").order_by("name"),
        "segpresets": OcrPreset.objects.filter(
            type="segment").order_by("name"),
    }
    tasktype = "Batch"
    celerytask = tasks.ConvertPageTask

    if not request.method == "POST":
        return render_to_response("batch/batch.html", context, 
                        context_instance=RequestContext(request))

    try:
        paths = ocrutils.save_ocr_images(request.FILES.iteritems(), 
                temp=True, user=request.user.username,
                name=tasktype.lower())
    except AppException, err:
        return HttpResponse(simplejson.dumps({"error": err.message}),
            mimetype="application/json")
    if not paths:
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")     
    
    # wrangle the params - this needs improving
    userparams = _get_best_params(request.POST.copy())

    # create a batch db job
    batch_name = request.POST.get("name", "%s %s" % (tasktype, datetime.now()))
    batch = OcrBatch(user=request.user, name=batch_name,
            task_type=celerytask.name, batch_type="MULTI")
    batch.save()

    subtasks = []
    try:
        for path in paths:
            tid = ocrutils.get_new_task_id(path) 
            ocrtask = OcrTask(task_id=tid, user=request.user, batch=batch, 
                    page_name=os.path.basename(path), status="INIT")
            ocrtask.save()
            subtasks.append(
                celerytask.subtask(
                    args=(path.encode(), userparams),
                    options=dict(task_id=tid, loglevel=60, retries=2)))            
        tasksetresults = TaskSet(tasks=subtasks).apply_async()

        # return a serialized result
        jsonserializer = serializers.get_serializer("json")()     
        out = jsonserializer.serialize(
            [batch], 
            relations={
                "tasks": {
                    "excludes": ("args", "kwargs"),    
                },
                "user": {
                    "fields": ("username"),
                }
            },
        )

    except Exception, e:
        transaction.rollback()
        print e.message
        return HttpResponse(e.message, 
                mimetype="application/json")

    transaction.commit()
    return HttpResponse(out, 
            mimetype="application/json")


@login_required
def results(request, pk):
    """
    Get results for a taskset.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    jsonserializer = serializers.get_serializer("json")()     
    out = jsonserializer.serialize(
        batch.tasks.all(),
        excludes=("args", "kwargs")
    )
    return HttpResponse(out, 
            mimetype="application/json")


