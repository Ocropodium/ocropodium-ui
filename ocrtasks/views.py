"""
View the task objects that are created when submitting a celery task
and updated by it's subsequent signals.
"""

from types import ClassType, MethodType

from celery.task.control import revoke
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

PER_PAGE = 20


def task_query(params):
    """
    Query the task db.
    """
    order = [x for x in params.getlist("order_by") if x != ""] or ["created_on"]
    status = params.getlist("status")
    query =  Q()
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
    return list(request)


@login_required
def list(request):
    """
    Return a list of currently running tasks according to
    GET filter settings.
    """

    excludes = ["args", "kwargs",]
    params = request.GET.copy()
    context = { 
        "statuses": OcrTask.STATUS_CHOICES,
        "params" : params,
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
            "next_page_number", "number", "start_index", "previous_page_number")
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
            "batch": {
                "relations": {
                    "user": {
                        "fields": ("username"),
                    }
                }
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
    
    fields = ["page_name", "batch__user", "updated_on", "status"]
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
            "selected" : selected,
            "allstatus" : allstatus,
            "refresh"   : autorf,
            "refresh_time"   : autorf_time,
    }
    template = "ocrtasks/list.html" if not request.is_ajax() \
            else "ocrtasks/includes/task_list.html"
    response = render_to_response(template, context, 
            context_instance=RequestContext(request))    
    #if request.is_ajax():
    #    response = HttpResponse(serializers.serialize("json", tasks), 
    #               mimetype="application/json") 
    response.set_cookie("tlstatus", " ".join(selected)) 
    response.set_cookie("tlorder", " ".join(order))
    response.set_cookie("tlrefresh", autorf)
    response.set_cookie("tlrefresh_time", autorf_time)
    return response


@login_required
def delete(request, pk=None):
    """
    Delete a task or tasks.
    """
    response = HttpResponse()
    if not pk is None:
        t = get_object_or_404(OcrTask, pk=pk)
        t.delete()
    else:
        pks = request.POST.getlist("pk")
        taskquery = OcrTask.objects.filter(pk__in=pks)
        if not request.user.is_staff:
            taskquery = taskquery.filter(batch__user=request.user)
            if not len(taskquery) == len(pks):
                response.status_code = 201
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
def show(request, pk):
    """
    Show task details.
    """

    task = get_object_or_404(OcrTask, pk=pk)

    context = {"task": task}
    template = "ocrtasks/show.html" if not request.is_ajax() \
            else "ocrtasks/includes/show_task.html"
    return render_to_response(template, context, 
            context_instance=RequestContext(request))



@login_required
def revoke(request, task_id):
    """
    Revoke a task (cancel it's execution.)
    """
    print revoke(task_id)
    return HttpResponseRedirect("/ocrtasks/list")


