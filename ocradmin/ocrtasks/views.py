"""
View the task objects that are created when submitting a celery task
and updated by it's subsequent signals.
"""

from django.http import HttpResponse
from django.shortcuts import render, get_object_or_404
from django.utils import simplejson as json
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.core import generic_views as gv


tasklist = gv.GenericListView.as_view(
        model=OcrTask,
        page_name="OCR Tasks",
        fields=["id", "page_name", "user", "status", "progress", "created_on"],)


taskdelete = gv.GenericDeleteView.as_view(
        model=OcrTask,
        page_name="Delete OCR Task",
        success_url="/ocrtasks/list/",)


taskdetail = gv.GenericDetailView.as_view(
        model=OcrTask,
        page_name="OCR Task",
        fields=["id", "page_name", "lines", "user", "batch", "created_on",
            "updated_on", "status", "progress"])        


def show(request, pk):
    """
    Show task details.
    """

    task = get_object_or_404(OcrTask, pk=pk)
    context = dict(
        object=task,
        fields=["id","page_name", "lines", "user", "batch",
            "created_on", "updated_on", "status", "progress"],
        transcript=task.latest_transcript(),
    )
    template = "ocrtasks/show.html" if not request.is_ajax() \
            else "ocrtasks/includes/task_info.html"
    return render(request, template, context)


def retry(request, task_pk):
    """
    Retry a batch task.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    out = {"ok": True}
    try:
        task.retry()
    except StandardError, err:
        out = {"error": err.message}
    return HttpResponse(json.dumps(out), mimetype="application/json")


def abort(request, task_pk):
    """
    Abort a batch task.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)
    out = {"ok": True}
    try:
        task.abort()
    except StandardError, err:
        out = {"error": err.message}
    return HttpResponse(json.dumps(out), mimetype="application/json")




    
