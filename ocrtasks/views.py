from django import forms
from django.contrib.auth.decorators import login_required
from django.core import serializers
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson

from ocradmin.ocrtasks.models import OcrTask


def task_query(params):
    """
    Query the task db.
    """
    order = filter(lambda x: x != "", params.getlist("order")) or ["created_on"]
    status = params.getlist("status")
    query = Q()
    if status and "ALL" not in status:
        query = Q(status__in=status)
    for key, val in params.items():
        if not key in OcrTask._meta.get_all_field_names():
            continue
        if key == "status" or not val:
            continue
        ld = {str(key): str(val)}
        query = query & Q(**ld)
    return OcrTask.objects.filter(query).order_by(*order)


@login_required
def index(request):
    """
    Default view.
    """
    return list(request)


@login_required
def list(request):
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
    
    fields = ["page", "user", "updated_on", "status"]
    allstatus = False if len(selected) > 1 else ("ALL" in selected)
    # add a 'invert token' if we're ordering by the same field again
    fields = map(lambda x: "-%s" % x if x in order else x, fields)
    tasks = task_query(params)
    context = { 
            "tasks": tasks, 
            "fields": fields, 
            "statuses": OcrTask.STATUS_CHOICES,
            "selected" : selected,
            "allstatus" : allstatus,
            "refresh"   : autorf,
            "refresh_time"   : autorf_time,
    }
    template = "ocrtasks/list.html" if not request.is_ajax() \
            else "ocrtasks/includes/task_list.html"
    response = render_to_response(template, context, context_instance=RequestContext(request))    
    #if request.is_ajax():
    #    response = HttpResponse(serializers.serialize("json", tasks), mimetype="application/json") 
    response.set_cookie("tlstatus", " ".join(selected)) 
    response.set_cookie("tlorder", " ".join(order))
    response.set_cookie("tlrefresh", autorf)
    response.set_cookie("tlrefresh_time", autorf_time)
    return response


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
    return render_to_response(template, context, context_instance=RequestContext(request))



