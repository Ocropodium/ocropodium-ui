"""
Basic OCR functions.  Submit OCR tasks and retrieve the result.
"""

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
from django.shortcuts import render_to_response
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.ocr import tasks
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.ocrtasks.models import OcrTask, OcrBatch 


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
        return render_to_response("ocr/batch.html", context, 
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
            ocrtask = OcrTask(task_id=tid, batch=batch, 
                    page_name=os.path.basename(path), status="INIT")
            ocrtask.save()
            subtasks.append(
                celerytask.subtask(
                    args=(path.encode(), userparams),
                    options=dict(task_id=tid, loglevel=60, retries=2)))            
        tasksetresults = TaskSet(tasks=subtasks).apply_async()
        out = {
            "job_name": tasksetresults.taskset_id,
            "count" : tasksetresults.total,
            "subtasks" : [t.task_id for t in tasksetresults.subtasks],
            "completed_count": tasksetresults.completed_count(),
            "done": tasksetresults.successful() | tasksetresults.failed(),
        }
    except Exception, e:
        transaction.rollback()
        print e.message
        return HttpResponse(e.message, 
                mimetype="application/json")

    transaction.commit()
    return HttpResponse(simplejson.dumps(out), 
            mimetype="application/json")


@login_required
def batch_results(request, job_name):
    """
    Get results for a taskset.
    """
    subtasks = request.POST.getlist("task_id")
    asynctasks = [celeryresult.AsyncResult(t) for t in subtasks]
    tasksetresults = celeryresult.TaskSetResult(job_name, asynctasks)
    out = {
        "job_name": tasksetresults.taskset_id,
        "count" : tasksetresults.total,
        "completed_count": tasksetresults.completed_count(),
        "done": tasksetresults.successful() | tasksetresults.failed(),
    }
    return HttpResponse(simplejson.dumps(out), 
            mimetype="application/json")


@login_required
@transaction.commit_manually
def binarize(request):
    """
        Save a posted image to the DFS.  Binarize it with Celery.
    """

    return _ocr_task(
        request,
        "ocr/binarize.html",
        {},
        "Binarize",
        tasks.BinarizePageTask,
    )



@login_required
@transaction.commit_manually
def convert(request):
    """
    Save a posted image to the DFS and convert it with Celery.
    """

    # add available seg and bin presets to the context
    context = {
        "binpresets": OcrPreset.objects.filter(
            type="binarize").order_by("name"),
        "segpresets": OcrPreset.objects.filter(
            type="segment").order_by("name"),
    }

    return _ocr_task(
        request,
        "ocr/convert.html",
        context,
        "Convert",
        tasks.ConvertPageTask,
    )


@login_required
@transaction.commit_manually
def segment(request):
    """
        Save a posted image to the DFS.  Segment it with Celery.
    """

    # add available seg and bin presets to the context
    context = {
        "binpresets": OcrPreset.objects.filter(
            type="binarize").order_by("name"),
    }

    return _ocr_task(
        request,
        "ocr/segment.html",
        context,
        "Segment",
        tasks.SegmentPageTask,
    )


@login_required
def results(request, job_name):
    """
    Retrieve the results using the previously provided task name.
    """
    async = celeryresult.AsyncResult(job_name)
    if async is None:
        raise Http404

    return _format_task_results(request, async)


@login_required
def components(request):
    """
    List OCRopus components - either all or those
    of an optional type.
    """
    comps = ocrutils.get_ocropus_components(
            request.GET.getlist("type"), request.GET.getlist("name"))
    return HttpResponse(simplejson.dumps(comps), mimetype="application/json")


def test(request):
    """
    Dummy action for running JS unit tests.  Probably needs to
    be put somewhere else.
    """
    return render_to_response("ocr/test.html", {})


def _ocr_task(request, template, context, tasktype, celerytask):
    """
    Generic handler for OCR tasks which run a celery job.
    """
    if not request.method == "POST":
        return render_to_response(template, context, 
                        context_instance=RequestContext(request))

    # save our files to the DFS and return a list of addresses
    if request.POST.get("png"):
        paths = [ocrutils.media_url_to_path(request.POST.get("png"))]
    else:
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
    batch = OcrBatch(user=request.user, name="%s %s" % (tasktype, datetime.now()),
            task_type=celerytask.name, batch_type="ONESHOT")
    batch.save()

    # init the job from our params
    asynctasks = []
    for path in paths:
        tid = ocrutils.get_new_task_id(path) 
        ocrtask = OcrTask(task_id=tid, batch=batch, 
                page_name=os.path.basename(path), status="INIT")
        ocrtask.save()
        asynctasks.append(
            celerytask.apply_async(
                args=(path.encode(), userparams),
                    task_id=tid, loglevel=60, retries=2))            
    try:
        # aggregate the results
        out = []
        for async in asynctasks:
            result = async.wait() if _should_wait(request) else async.result
            out.append({
                "job_name": async.task_id,
                "status": async.status,
                "results": result,
            })
        # should be past the danger zone now...
        transaction.commit()
        return _json_or_text_response(request, out)

    except Exception, err:
        print err
        transaction.rollback()
        return HttpResponse(
            simplejson.dumps({
                "error": err.message, 
                "trace": "\n".join(
                    [ "\t".join(str(t)) for t in traceback.extract_stack()]
                )
            }),
            mimetype="application/json"
        ) 




def _format_task_results(request, async):
    """
    Wrap the results in JSON metadata.  Treat
    exceptions as a special case.
    """
    if async.status == "FAILURE":
        err = async.result
        taskmeta = OcrTask.objects.get(task_id=async.task_id)
        return HttpResponse(
            simplejson.dumps({
                "error": err.message, 
                "trace": taskmeta.traceback
            }),
            mimetype="application/json"
        )
    return _json_or_text_response(
        request, {
            "job_name": async.task_id,
            "status": async.status,
            "results": async.result
        }
    )



def _wants_text_format(request):
    """
    Determine whether we should send back plain text instead of JSON.
    """    
    return request.META.get("HTTP_ACCEPT", "") == "text/plain" \
        or request.GET.get("format", "") == "text" \
        or request.POST.get("format", "") == "text"


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


def _json_or_text_response(request, json):
    """
    Format the output string accordingly.
    """
    mimetype = "application/json"

    # bad code alert!  if uploaded via the dodgy
    # Ajax iframe method, force a text response
    # otherwise firefox eats the results for us...
    if request.POST.get("_iframe"):
        mimetype = "text/html"

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
                result += ocrutils.output_to_plain_text(page.get("results"))
                result += "\n"
    else:
        result = simplejson.dumps(json)
    return HttpResponse(result, mimetype=mimetype)


def _get_preset_data(param):
    """
    Fetch a preset by primary key and return its data
    dict for merging into OCR params.  Try to get the
    preset via primary key (as used via the web UI) 
    or name (as used via Curl).
    """
    pmatch = re.match("preset_(\d+)", param)
    data = None
    #keyval = {}
    if pmatch:
        keyval = dict(pk=pmatch.groups()[0])
    else:
        keyval = dict(name=param)

    try:
        preset = OcrPreset.objects.get(**keyval)
        data = preset.data
    except OcrPreset.DoesNotExist:
        pass
    return data



def _get_best_params(postdict):
    """
    Attempt to determine the best params if not specified in
    POST.  This is contingent on data in the models table.
    TODO: Make this less horrible
    """

    userparams = postdict    
    userparams["engine"] = postdict.get("engine", "tesseract")

    # get the bin and seg params.  These are either dicts or default strings
    segparam = postdict.get("psegmenter", "SegmentPageByRAST")
    segdata = _get_preset_data(segparam)
    if segdata:
        userparams.update(segdata)
    else:
        userparams["psegmenter"] = segparam

    binparam = postdict.get("clean", "StandardPreprocessing")
    bindata = _get_preset_data(binparam)
    if bindata:
        userparams.update(bindata)
    else:
        userparams["clean"] = binparam

    # get the lmodel/cmodel, either model object paths or defaults
    for modparam in ("cmodel", "lmodel"):
        try:
            model = OcrModel.objects.get(name=userparams.get(modparam, "???"))
            userparams[modparam] = model.file.path            
        except OcrModel.DoesNotExist:
            # try and choose the best model accordingly - this is a model
            # named "Default Something"
            modtype = "char" if modparam == "cmodel" else "lang"
            try:
                model = OcrModel.objects.filter(
                    name__icontains="default",
                    app__iexact=userparams["engine"],
                    type__iexact=modtype,
                )[0]
                userparams[modparam] = model.file.path            
            except IndexError:
                userparams[modparam] = "???" 

    return userparams    
