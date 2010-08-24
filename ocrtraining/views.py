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
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, Http404, HttpResponseServerError 
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from django import forms
from ocradmin.ocr import tasks
from ocradmin.ocr import utils as ocrutils

from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrtasks.models import OcrTask, OcrBatch, Transcript
from ocradmin.projects.models import OcrProject
from ocradmin.ocrtraining.models import TrainingPage

from ocradmin.projects.utils import project_required

from ocradmin.ocrtraining.tasks import LineTrainTask


class TrainingSetForm(forms.Form):
    """
    Form for submitting a new training set.
    """
    name = forms.CharField()
    cmodel = forms.ModelChoiceField(
            queryset=OcrModel.objects.filter(type="char", app="ocropus"))



@project_required
@login_required
def new(request):
    """
    Show a new training task form.
    """
    # initialize the training set name
    project = request.session["project"]
    trainnum = project.tasks.filter(task_type="train").count() + 1
    name = "%s Training %d" % (project.name, trainnum)

    template = "ocrtraining/new.html"
    context = {
        "form": TrainingSetForm(initial=dict(name=name)),
        "project": request.session["project"],
    }
    return render_to_response(template, context, 
            context_instance=RequestContext(request))


@project_required
@login_required
def create(request):
    """
    Create a new training task.
    """
    project = request.session["project"]
    form = TrainingSetForm(request.POST)
    if not form.is_valid():
        template = "ocrtraining/new.html"          
        context = {
            "form": form,
            "project": project,
        }
        return render_to_response(template, context, 
                context_instance=RequestContext(request))
    
    name = form.cleaned_data["name"]
    cmodel = form.cleaned_data["cmodel"]
    # we're ok with the params... now get a temporary
    # output path:
    outpath = ocrutils.FileWrangler(
        username=request.user.username,
        temp=True,
        action="train",
        stamp=True,        
    )()
    
    # make us a new task entry
    tid = ocrutils.get_new_task_id()
    args = ([ts.pk for ts in project.training_sets.all()], cmodel.pk, outpath)
    kwargs = dict(task_id=tid, loglevel=60, retries=2,) # could add a 'queue' param here
    task = OcrTask(
        task_id=tid,
        user = request.user,
        project = project,
        page_name=name,
        task_type="train",
        status="INIT",
        args=args,
        kwargs=kwargs,        
    )
    task.save()
    print "SENDING: %s, %s" % (args, kwargs)
    LineTrainTask.apply_async(args=args, **kwargs)

    return HttpResponseRedirect("/projects/list")





@project_required
@login_required
def save_task(request, pk):
    """
    Save a page and it's binary image as 
    training data.
    """
    task = get_object_or_404(OcrTask, pk=pk)
    binurl = request.POST.get("binary_image")
    if not binurl:
        raise HttpResponseServerError("No binary image url given.")
    binpath = ocrutils.media_url_to_path(binurl)
    if not os.path.exists(binpath):
        raise HttpResponseServerError("Binary image does not exist")

    outpath = ocrutils.FileWrangler(
        username=request.user.username,
        project_id=request.session["project"].pk,
        training=True,
        temp=False,
    )()
    if not os.path.exists(outpath):
        os.makedirs(outpath)
        os.chmod(outpath, 0777)
    trainpath = os.path.join(outpath, os.path.basename(binpath))
    import shutil
    shutil.copy2(binpath, trainpath)
    
    try:
        tp = TrainingPage(
            user=request.user,
            project=request.session["project"],
            data=task.latest_transcript(),
            binary_image_path=trainpath,            
        )
        tp.save()
    except IntegrityError, e:
        return HttpResponse(simplejson.dumps({"error": str(e)}),
                mimetype="application/json")


    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")

    

    
