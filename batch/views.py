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
from django.core.serializers.json import DjangoJSONEncoder
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
def new(request):
    """
    Present a new batch form.
    """
    template = "batch/new.html"
    # add available seg and bin presets to the context
    context = {
        "binpresets": OcrPreset.objects.filter(
            type="binarize").order_by("name"),
        "segpresets": OcrPreset.objects.filter(
            type="segment").order_by("name"),
    }
    return render_to_response(template, context, 
            context_instance=RequestContext(request))    


@login_required
@transaction.commit_manually
def create(request):
    """
    Create a batch from pre-saved images convert them with Celery.
    """

    tasktype = "Batch"
    celerytask = tasks.ConvertPageTask

    if not request.method == "POST":
        return render_to_response("batch/new.html", context, 
                        context_instance=RequestContext(request))

    filenames = request.POST.get("files", "").split(",")
    dirpath = ocrutils.get_ocr_path(user=request.user.username, 
            temp=False, subdir=None, timestamp=False)
    paths = [os.path.join(dirpath, f) for f in filenames]
    
    if not paths:
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")     
    
    # wrangle the params - this needs improving
    userparams = _get_best_params(request.POST.copy())

    # create a batch db job
    batch_name = request.POST.get("batch_name", "%s %s" % (tasktype, datetime.now()))
    batch_desc = request.POST.get("batch_desc", "")
    batch = OcrBatch(user=request.user, name=batch_name, description=batch_desc,
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
                    celerytask.subtask(args=(path.encode(), userparams), 
                        options=dict(task_id=tid, loglevel=60, retries=2)))
        tasksetresults = TaskSet(tasks=subtasks).apply_async()
    except Exception, e:
        transaction.rollback()
        print e.message
        return HttpResponse(e.message, mimetype="application/json")

    # return a serialized result
    transaction.commit()
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch), response, cls=DjangoJSONEncoder)
    return response



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
                    celerytask.subtask(args=(path.encode(), userparams), 
                        options=dict(task_id=tid, loglevel=60, retries=2)))
        tasksetresults = TaskSet(tasks=subtasks).apply_async()
    except Exception, e:
        transaction.rollback()
        print e.message
        return HttpResponse(e.message, mimetype="application/json")

    # return a serialized result
    transaction.commit()
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch), response, cls=DjangoJSONEncoder)
    return response


@login_required
def results(request, pk):
    """
    Get results for a taskset.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    try:
        start = int(request.GET.get("start", 0))
    except ValueError:
        start = 0
    try:
        limit = int(request.GET.get("limit", 25))
    except ValueError:
        limit = 25
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch, start, limit), 
            response, cls=DjangoJSONEncoder)
    return response


@login_required
def latest(request):
    """
    View the latest batch.
    """
    try:
        batch = OcrBatch.objects.filter(user=request.user)\
                .order_by("-created_on")[0]
    except OcrBatch.DoesNotExist:
        raise Http404

    return _show_batch(request, batch)


@login_required
def show(request, pk):
    """
    View a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    return _show_batch(request, batch)


@login_required
def upload_files(request):
    """
    Upload files to the server for batch-processing.
    """
    try:
        paths = ocrutils.save_ocr_images(request.FILES.iteritems(), 
                temp=False, user=request.user.username,
                name=None, timestamp=False)
    except AppException, err:
        return HttpResponse(simplejson.dumps({"error": err.message}),
            mimetype="application/json")
    if not paths:
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")     
    pathlist = [os.path.basename(p) for p in paths]
    return HttpResponse(simplejson.dumps(pathlist),
            mimetype="application/json")



def _show_batch(request, batch):
    """
    View a (passed-in) batch.
    """
    template = "batch/show.html"
    context = {"batch": batch}

    return render_to_response(template, context, 
            context_instance=RequestContext(request))


@login_required
def retry_task(request, pk):
    """
    Retry a batch task.
    """
    task = get_object_or_404(OcrTask, pk=pk)
    _retry_celery_task(task)
    return HttpResponse(simplejson.dumps({"ok": True}), 
            mimetype="application/json")



@transaction.commit_manually
@login_required
def retry_batch(request, pk):
    """
    Retry all tasks in a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    for task in batch.tasks.all():
        _retry_celery_task(task)        
    transaction.commit()
    return HttpResponse(simplejson.dumps({"ok": True}), 
            mimetype="application/json")



def _retry_celery_task(task):
    """
    Set a task re-running.
    """
    celerytask = tasks.ConvertPageTask
    celerytask.retry(args=task.args, kwargs=task.kwargs,
                options=dict(task_id=task.task_id, loglevel=60, retries=2), 
                countdown=0, throw=False)
    task.status = "RETRY"
    task.progress = 0
    task.save()


def _serialize_batch(batch, start=0, limit=25):
    """
    Hack around the problem of serializing
    an object AND it's child objects.
    """
    pyserializer = serializers.get_serializer("python")()     
    batchsl = pyserializer.serialize(
        [batch],
        extras=("estimate_progress", "task_count",),
        relations={
            "user":  { "fields": ("username") }
        },
    )
    taskssl = pyserializer.serialize(
        batch.tasks.all()[start:start + limit],
        excludes=("args", "kwargs"),
    )
    batchsl[0]["fields"]["tasks"] = taskssl
    return batchsl
    
