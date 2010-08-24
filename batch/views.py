import re
import os
import traceback
from types import ClassType, MethodType
from datetime import datetime
from celery import result as celeryresult
from celery.contrib.abortable import AbortableAsyncResult
from celery.task.sets import TaskSet, subtask
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core import serializers
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, Http404, HttpResponseServerError 
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.ocr import tasks
from ocradmin.ocr import utils as ocrutils
from ocradmin.batch import utils as batchutils
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.ocrtasks.models import OcrTask, OcrBatch, Transcript
from ocradmin.ocrtraining.models import TrainingPage

from ocradmin.projects.utils import project_required
from ocradmin.ocr.views import _get_best_params, _cleanup_params


PER_PAGE = 10


def batch_query(params):
    """
    Query the batch db.
    """
    order = [x for x in params.getlist("order_by") if x != ""] or ["created_on"]
    query =  Q()
    for key, val in params.items():
        if key.find("__") == -1 and \
                not key in OcrBatch._meta.get_all_field_names():
            continue
        if not val:
            continue
        query = query & Q(**{str(key): str(val)})
    return OcrBatch.objects.select_related().filter(query).order_by(*order)


@login_required
@project_required
def new(request):
    """
    Present a new batch form.
    """
    template = "batch/new.html" if not request.is_ajax() \
        else "batch/includes/new_form.html"
    # add available seg and bin presets to the context
    # work out the name of the batch - start with how
    # many other batches there are in the projects
    project = request.session["project"]
    batchname = "%s - Batch %d" % (project.name,
            project.ocrbatch_set.count() + 1)
    context = {
        "batchname": batchname,
        "binpresets": OcrPreset.objects.filter(
            type="binarize").order_by("name"),
        "segpresets": OcrPreset.objects.filter(
            type="segment").order_by("name"),
    }
    return render_to_response(template, context, 
            context_instance=RequestContext(request))    


@login_required
@project_required
def list(request):
    """
    List recent batches.
    """
    excludes = ["args", "kwargs", "traceback", ]
    params = request.GET.copy()
    params["project__pk"] = request.session["project"].pk
    context = { 
        "params" : params,
    }
    
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
            "next_page_number", "number", "start_index", "previous_page_number")
    for attr in wanted:
        v = getattr(batches, attr)
        if isinstance(v, MethodType):
            serializedpage[attr] = v()
        elif isinstance(v, (str, int)):
            serializedpage[attr] = v
    # This gets rather gnarly, see: 
    # http://code.google.com/p/wadofstuff/wiki/DjangoFullSerializers
    serializedpage["params"] = params
    serializedpage["object_list"] = pythonserializer.serialize(
        batches.object_list, 
        extras=( "username", ),
    ) 

    response = HttpResponse(mimetype="application/json")
    simplejson.dump(serializedpage, response,
            cls=DjangoJSONEncoder, ensure_ascii=False)
    return response

    
@login_required
@project_required
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

    # wrangle the params - this needs improving
    userparams = _get_best_params(
            _cleanup_params(request.POST.copy(), ("files", "batch_name", "batch_desc")))

    # create a batch db job
    batch_name = request.POST.get("batch_name", "%s %s" % (tasktype, datetime.now()))
    batch_desc = request.POST.get("batch_desc", "")
    batch = OcrBatch(user=request.user, name=batch_name, description=batch_desc,
            task_type=celerytask.name, batch_type="MULTI", project=request.session["project"])    
    batch.save()

    filenames = request.POST.get("files", "").split(",")
    dirpath = ocrutils.get_ocr_path(user=request.user.username, 
            temp=False, subdir=None, timestamp=False)
    outdir = ocrutils.FileWrangler(
            username=request.user.username, temp=True, batch_id=batch.pk, )()
    userparams["intermediate_outdir"] = outdir.encode()
    paths = [os.path.join(dirpath, f) for f in sorted(filenames)]
    if not paths:
        transaction.rollback()
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")     

    subtasks = []
    try:
        for path in paths:
            tid = ocrutils.get_new_task_id(path)
            args = (path.encode(), outdir.encode(), userparams)
            kwargs = dict(task_id=tid, loglevel=60, retries=2)
            ocrtask = OcrTask(
                task_id=tid,
                user=request.user,
                batch=batch, 
                page_name=os.path.basename(path),
                status="INIT",
                args=args,
                kwargs=kwargs,
            )
            ocrtask.save()
            subtasks.append(celerytask.subtask(args=args, options=kwargs))
        tasksetresults = TaskSet(tasks=subtasks).apply_async()
    except Exception, e:
        transaction.rollback()
        print e.message
        return HttpResponse(e.message, mimetype="application/json")

    # return a serialized result
    transaction.commit()
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch), response, 
            cls=DjangoJSONEncoder, ensure_ascii=False)
    return response



@login_required
@project_required
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
    outdir = ocrutils.FileWrangler(
            username=request.user.username, temp=True, action="batch")()
    try:
        paths = ocrutils.save_ocr_images(request.FILES.iteritems(), outdir)
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
            task_type=celerytask.name, batch_type="MULTI", project=request.session["project"])
    batch.save()
    subtasks = []
    try:
        for path in paths:
            tid = ocrutils.get_new_task_id(path)
            args = (path.encode(), outdir.encode(), userparams)
            kwargs = dict(task_id=tid, loglevel=60, retries=2)
            ocrtask = OcrTask(
                task_id=tid,
                user=request.user,
                batch=batch, 
                args=args,
                kwargs=kwargs,
                page_name=os.path.basename(path),
                status="INIT"
            )
            ocrtask.save()
            subtasks.append(celerytask.subtask(args=args, options=kwargs))
        tasksetresults = TaskSet(tasks=subtasks).apply_async()
    except Exception, e:
        transaction.rollback()
        print e.message
        return HttpResponse(e.message, mimetype="application/json")

    # return a serialized result
    transaction.commit()
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch), response,
            cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
def results(request, pk):
    """
    Get results for a taskset.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    try:
        start = max(0, int(request.GET.get("start", 0)))
    except ValueError:
        start = 0
    try:
        limit = max(1, int(request.GET.get("limit", 25)))
    except ValueError:
        limit = 25
    statuses = request.GET.getlist("status")
    if "ALL" in statuses:
        statuses = None
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(_serialize_batch(batch, start, limit, statuses), 
            response, cls=DjangoJSONEncoder, ensure_ascii=False)
    return response


@login_required
def page_results(request, pk, page_index):
    """
    Get the results for a single page.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    try:
        page = batch.tasks.all().order_by("page_name")[int(page_index)]
    except OcrBatch.DoesNotExist, e:
        raise e

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
def save_page_data(request, pk, page_index):
    """
    Save data for a single page.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    try:
        page = batch.tasks.all().order_by("page_name")[int(page_index)]
    except OcrBatch.DoesNotExist, e:
        raise e

    json = request.POST.get("data")
    if not json:
        return HttpResponseServerError("No data passed to 'save' function.")
    data = simplejson.loads(json)
    result = Transcript(data=data, task=page)
    result.save()

    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")


@login_required
def submit_viewer_binarization(request, pk):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    task = get_object_or_404(OcrTask, pk=pk)
    # hack!  add an allowcache to the params dict to indicate
    # that we don't want to remake an existing binary
    args = task.args
    args[2]["allowcache"] = True
    async = tasks.BinarizePageTask.apply_async(args=args,
            queue="interactive")
    out = {
        "job_name": async.task_id,
        "status": async.status,
        "results": async.result,
    }
    return HttpResponse(simplejson.dumps(out),
            mimetype="application/json")


@login_required
def viewer_binarization_results(request, task_id):
    """
    Trigger a re-binarization of the image for viewing purposes.
    """
    async = celeryresult.AsyncResult(task_id)    
    out = {
        "job_name": async.task_id,
        "status": async.status,
        "results": async.result,
    }
    return HttpResponse(simplejson.dumps(out),
            mimetype="application/json")


@login_required
@project_required
def latest(request):
    """
    View the latest batch.
    """
    try:
        batch = OcrBatch.objects.filter(
            user=request.user, 
            project=request.session["project"]
        ).order_by("-created_on")[0]
    except OcrBatch.DoesNotExist:
        raise Http404

    return _show_batch(request, batch)


@login_required
def show(request, pk):
    """
    View a batch.
    """
    batch = get_object_or_404(
        OcrBatch,
        pk=pk,
        project=request.session["project"]
    )
    return _show_batch(request, batch)


@login_required
@project_required
def upload_files(request):
    """
    Upload files to the server for batch-processing.
    """
    print request.POST
    print request.FILES
    mimetype = "application/json" if not request.POST.get("_iframe") \
            else "text/html"

    try:
        outdir = ocrutils.FileWrangler(
                username=request.user.username, temp=False, stamp=False, action=None)()
        print "OUTDIR: ", outdir
        paths = ocrutils.save_ocr_images(request.FILES.iteritems(),  outdir)
    except AppException, err:
        return HttpResponse(simplejson.dumps({"error": err.message}),
            mimetype="application/json")
    if not paths:
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")     
    pathlist = [os.path.basename(p) for p in paths]
    return HttpResponse(simplejson.dumps(pathlist),
            mimetype=mimetype)


@login_required
@project_required
def transcript(request, pk):
    """
    View the transcription of a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    template = "batch/transcript.html"
    context = {"batch": batch}

    return render_to_response(template, context, 
            context_instance=RequestContext(request))





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
    try:
        _retry_celery_task(task)
    except Exception, e:
        return HttpResponse(simplejson.dumps({"error": e.message}), 
                mimetype="application/json")

    return HttpResponse(simplejson.dumps({"ok": True}), 
            mimetype="application/json")


@login_required
def abort_task(request, pk):
    """
    Abort a batch task.
    """
    task = get_object_or_404(OcrTask, pk=pk)
    return HttpResponse(simplejson.dumps({"ok": _abort_celery_task(task)}), 
            mimetype="application/json")

    
@transaction.commit_manually
@login_required
def abort_batch(request, pk):
    """
    Abort an entire batch.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    for task in batch.tasks.all():
        _abort_celery_task(task)
    transaction.commit()
    return HttpResponse(simplejson.dumps({"ok": True}), 
            mimetype="application/json")


@transaction.commit_manually
@login_required
def retry(request, pk):
    """
    Retry all tasks in a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    for task in batch.tasks.all():
        _retry_celery_task(task)        
    transaction.commit()
    return HttpResponse(simplejson.dumps({"ok": True}), 
            mimetype="application/json")


@transaction.commit_manually
@login_required
def retry_errors(request, pk):
    """
    Retry all errored tasks in a batch.
    """
    batch = get_object_or_404(OcrBatch, pk=pk)
    for task in batch.errored_tasks():
        _retry_celery_task(task)        
    transaction.commit()
    return HttpResponse(simplejson.dumps({"ok": True}), 
            mimetype="application/json")


@login_required
def spellcheck(request):
    """
    Spellcheck some POST data.
    """
    json = request.POST.get("data")
    if not json:
        return HttpResponseServerError("No data passed to 'spellcheck' function.")
    data = simplejson.loads(json)
#    replacepunc = {}
#    for line in data.split("\n"):
#        for word in line.split(" "):
#            pmatch = re.match("([a-zA-Z])[\[\]\|\.,\"'!;]([a-zA-Z])", word)
#            if pmatch:
#                repl = "%sZZZ%s" % pmatch.groups() 
#                print "Got spell match: %s -> %s" % (word, repl)
#                replacepunc[word] = repl
#                data = data.replace(word, repl, 1)

    aspell = batchutils.Aspell()
    spelldata = aspell.spellcheck(data)
#    for word in spelldata.keys():
#        if replacepunc.get(word):
#            print "Replacing %s -> %s" % (replacepunc[word], word)
#            spelldata[replacepunc[word]] = spelldata[word]
#            del spelldata[word]

    response = HttpResponse(mimetype="application/json")
    simplejson.dump(spelldata, response, ensure_ascii=False)
    return response

def _abort_celery_task(task):
    """
    Abort a task.
    """
    if not task.is_active():
        return False
    
    asyncres = AbortableAsyncResult(task.task_id)
    asyncres.revoke()
    asyncres.abort()
    if asyncres.is_aborted():
        task.status = "ABORTED"
        task.save()
    return asyncres.is_aborted()


def _retry_celery_task(task):
    """
    Set a task re-running.
    """                                             
    #celerytask = tasks.ConvertPageTask
    #celerytask.retry(args=task.args, kwargs=task.kwargs,
    #            options=dict(task_id=task.task_id, loglevel=60, retries=2), 
    #            countdown=0, throw=False)
    if task.is_abortable():
        _abort_celery_task(task)
    tid = ocrutils.get_new_task_id(task.page_name) 
    async = tasks.ConvertPageTask.apply_async(
            args=task.args, task_id=tid, loglevel=60, retries=2)
    task.task_id = async.task_id
    task.status = "RETRY"
    task.progress = 0
    task.save()


def _serialize_batch(batch, start=0, limit=25, statuses=None):
    """
    Hack around the problem of serializing
    an object AND it's child objects.
    """
    if statuses:
        taskqset = batch.tasks.filter(status__in=statuses)
    else:
        taskqset = batch.tasks.all()
    task_count = taskqset.count()
    pyserializer = serializers.get_serializer("python")()     
    batchsl = pyserializer.serialize(
        [batch],
        extras=("estimate_progress", "is_complete",),
        relations={
            "user":  { "fields": ("username") }
        },
    )
    taskssl = pyserializer.serialize(
        taskqset.order_by("page_name")[start:start + limit],
        excludes=("args", "kwargs", "traceback",),
    )
    batchsl[0]["fields"]["tasks"] = taskssl
    batchsl[0]["extras"]["task_count"] = task_count
    return batchsl
    
