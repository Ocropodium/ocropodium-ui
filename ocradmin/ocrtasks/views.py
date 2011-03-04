"""
View the task objects that are created when submitting a celery task
and updated by it's subsequent signals.
"""

from types import ClassType, MethodType

from celery.task.control import revoke
from celery import registry as celeryregistry
from celery.contrib.abortable import AbortableAsyncResult
from django.contrib.auth.decorators import login_required
from django.core import serializers
from django.core.serializers.json import DjangoJSONEncoder
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.ocr import utils as ocrutils

PER_PAGE = 20


def task_query(params):
    """
    Query the task db.
    """
    order = [x for x in params.getlist("order_by") if x != ""] \
            or ["created_on"]
    status = params.getlist("status")
    query = Q()
    if status and "ALL" not in status:
        query = Q(status__in=status)
    for key, val in params.items():
        if key.find("__") == -1 and \
                not key in OcrTask._meta.get_all_field_names():
            continue
        if key == "status" or not val:
            continue
        query = query & Q(**{str(key): str(val)})
    return OcrTask.objects.select_related().filter(query).order_by(*order)


@login_required
def index(request):
    """
    Default view.
    """
    return list_tasks(request)


@login_required
def list_tasks(request):
    """
    Return a list of currently running tasks according to
    GET filter settings.
    """
    excludes = ["args", "kwargs", "traceback", "results"]
    params = request.GET.copy()
    context = {
        "statuses": OcrTask.STATUS_CHOICES,
        "params": params,
    }
    if not request.is_ajax():
        return render_to_response("ocrtasks/list.html", context,
                context_instance=RequestContext(request))

    paginator = Paginator(task_query(params), PER_PAGE)
    try:
        page = int(request.GET.get('page', '1'))
    except ValueError:
        page = 1

    # If page request (9999) is out of range, deliver last page of results.
    try:
        tasks = paginator.page(page)
    except (EmptyPage, InvalidPage):
        tasks = paginator.page(paginator.num_pages)

    pythonserializer = serializers.get_serializer("python")()
    serializedpage = {}
    serializedpage["num_pages"] = paginator.num_pages
    wanted = ("end_index", "has_next", "has_other_pages", "has_previous",
            "next_page_number", "number",
            "start_index", "previous_page_number")
    for attr in wanted:
        v = getattr(tasks, attr)
        if isinstance(v, MethodType):
            serializedpage[attr] = v()
        elif isinstance(v, (str, int)):
            serializedpage[attr] = v
    # This gets rather gnarly, see:
    # http://code.google.com/p/wadofstuff/wiki/DjangoFullSerializers
    serializedpage["params"] = params
    serializedpage["object_list"] = pythonserializer.serialize(
        tasks.object_list,
        excludes=excludes,
        relations={
            "user": {
                "fields": ("username"),
            }
        },
    )

    response = HttpResponse(mimetype="application/json")
    simplejson.dump(serializedpage, response, cls=DjangoJSONEncoder)
    return response


@login_required
def list2(request):
    """
    List tasks.
    """
    params = request.GET.copy()
    autorf = request.COOKIES.get("tlrefresh", True)
    autorf_time = request.COOKIES.get("tlrefresh_time", 2)
    order = request.COOKIES.get("tlorder", "").split()
    selected = request.COOKIES.get("tlstatus", "").split()
    if request.GET.get("order"):
        order = request.GET.getlist("order")
    else:
        params.setlist("order", order)
    if request.GET.get("status"):
        selected = request.GET.getlist("status")
    else:
        params.setlist("status", selected)
    if request.GET.get("autorefresh"):
        autorf = True
    if request.GET.get("autorefresh_time"):
        autorf_time = request.GET.get("autorefresh_time")

    fields = ["page_name", "user", "updated_on", "status"]
    allstatus = False if len(selected) > 1 else ("ALL" in selected)
    revokable = ("INIT", "PENDING")
    # add a 'invert token' if we're ordering by the same field again
    fields = ["-%s" % x if x in order else x for x in fields]
    alltasks = task_query(params)
    paginator = Paginator(alltasks, PER_PAGE)
    try:
        page = int(request.GET.get('page', '1'))
    except ValueError:
        page = 1

    # If page request (9999) is out of range, deliver last page of results.
    try:
        tasks = paginator.page(page)
    except (EmptyPage, InvalidPage):
        tasks = paginator.page(paginator.num_pages)

    context = {
            "tasks": tasks,
            "fields": fields,
            "statuses": OcrTask.STATUS_CHOICES,
            "revokable": revokable,
            "selected": selected,
            "allstatus": allstatus,
            "refresh": autorf,
            "refresh_time": autorf_time,
    }
    template = "ocrtasks/list.html" if not request.is_ajax() \
            else "ocrtasks/includes/task_list.html"
    response = render_to_response(template, context,
            context_instance=RequestContext(request))
    response.set_cookie("tlstatus", " ".join(selected))
    response.set_cookie("tlorder", " ".join(order))
    response.set_cookie("tlrefresh", autorf)
    response.set_cookie("tlrefresh_time", autorf_time)
    return response


@login_required
def delete(request, task_pk=None):
    """
    Delete a task or tasks.
    """
    response = HttpResponse()
    if not pk is None:
        pks = [task_pk]
    else:
        pks = request.POST.getlist("task_pk")

    taskquery = OcrTask.objects.filter(pk__in=pks)
    if not request.user.is_staff:
        taskquery = taskquery.filter(user=request.user)
        if not len(taskquery) == len(pks):
            response.status_code = 201
    for task in taskquery:
        if task.is_revokable():
            print "Revoking %s" % task
            try:
                print "%s" % revoke(task.task_id)
            except Exception, e:
                print e.message
    taskquery.delete()
    if request.is_ajax():
        return response

    return HttpResponseRedirect("/ocrtasks/list")


@login_required
def update(request):
    """
    Update task list items.
    """

    for name, value in request.POST.iteritems():
        if name.startswith("tid_"):
            tid = name[3:]
            print "%s, %s" % (tid, value)

    return HttpResponseRedirect("/ocrtasks/list")


@login_required
def show(request, task_pk):
    """
    Show task details.
    """

    task = get_object_or_404(OcrTask, pk=task_pk)
    try:
        params = [(k, task.args[-1][k]) for k in \
                sorted(task.args[-1].keys())] if task.args \
                    else []
    except AttributeError:
        params = []

    context = {
        "task": task,
        "params": params,
        "transcript": task.latest_transcript(),
    }
    template = "ocrtasks/show.html" if not request.is_ajax() \
            else "ocrtasks/includes/show_task.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@login_required
def retry(request, task_pk):
    """
    Retry a batch task.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    out = {"ok": True}
    try:
        _retry_celery_task(task)
    except Exception, err:
        out = {"error": err.message}

    return HttpResponse(simplejson.dumps(out),
            mimetype="application/json")


@login_required
def abort(request, task_pk):
    """
    Abort a batch task.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    return HttpResponse(simplejson.dumps({"ok": _abort_celery_task(task)}),
            mimetype="application/json")




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
    if task.is_abortable():
        _abort_celery_task(task)
    tid = ocrutils.get_new_task_id()
    celerytask = celeryregistry.tasks[task.task_name]
    async = celerytask.apply_async(
            args=task.args, task_id=tid, loglevel=60, retries=2)
    task.task_id = async.task_id
    task.status = "RETRY"
    task.progress = 0
    task.save()



    
