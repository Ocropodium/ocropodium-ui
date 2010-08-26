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
from ocradmin.training.models import *

from ocradmin.projects.utils import project_required

from ocradmin.training.tasks import LineTrainTask, ComparisonTask


class TrainingSetForm(forms.Form):
    """
    Form for submitting a new training set.
    """
    name = forms.CharField()
    cmodel = forms.ModelChoiceField(
            queryset=OcrModel.objects.filter(type="char", app="ocropus"))
    notes = forms.CharField(required=False)



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

    template = "training/new.html"
    context = dict(
        form=TrainingSetForm(initial=dict(name=name)),
        project=request.session["project"],
        tsets=request.session["project"].training_sets.all(),
    )
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
    formok = form.is_valid()
    try: 
        tsets = TrainingPage.objects.filter(pk__in=request.POST.getlist("tset"))
    except TrainPage.DoesNotExist:
        formok = False

    if not formok:
        template = "training/new.html"          
        context = dict(
            form=form,
            tsets=project.training_sets.all(),
            project=project,
        )
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
    args = (tsets, cmodel, outpath)
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
    LineTrainTask.apply_async(args=args, **kwargs)

    return HttpResponseRedirect("/projects/list")



@project_required
@login_required
def compare(request):
    """
    Show a form allowing the user to
    submit a job comparing the results
    of two cmodels on a training set.
    """
    template = "training/compare.html"
    context = dict(
        project=request.session["project"],
        cmodels=OcrModel.objects.filter(app="ocropus", type="char"),
        lmodels=OcrModel.objects.filter(app="ocropus", type="lang"),
        tsets=request.session["project"].training_sets.all(),
    )
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.commit_on_success
@project_required
@login_required
def score_models(request):
    """
    Run a comparison between two models.
    """

    notes = request.POST.get("notes", "")
    lmodel = get_object_or_404(OcrModel, pk=request.POST.get("lmodel", 0))
    cmodel_a = get_object_or_404(OcrModel, pk=request.POST.get("cmodel_a", 0))
    cmodel_b = get_object_or_404(OcrModel, pk=request.POST.get("cmodel_b", 0))
    name = "%s %s" % (cmodel_a.name, cmodel_b.name)

    print request.POST
    try:
        tsets = TrainingPage.objects.filter(pk__in=request.POST.getlist("tset"))
    except TrainingPage.DoesNotExist:
        # FIXME: remove code dup!
        template = "training/compare.html"
        context = dict(
            project=request.session["project"],
            cmodels=OcrModel.objects.filter(app="ocropus", type="char"),
            lmodels=OcrModel.object.filter(app="ocropus", type="lang"),
            tsets=project.training_set.all(),
        )
        return render_to_response(template, context,
                context_instance=RequestContext(request))

    
    outdir = ocrutils.FileWrangler(
            username=request.user.username, temp=True, action="compare")()

    asyncparams = []

    # create a batch db job
    batch = OcrBatch(user=request.user, name="%s Job Batch" % name, description="",
            task_type=ComparisonTask.name, batch_type="COMPARISON", project=request.session["project"])    
    batch.save()

    comparison = OcrModelScoreComparison(
        name=name,
        notes=notes,
        batch=batch,
    )
    comparison.save()
    for gt in tsets:
        path = gt.binary_image_path
        for model in (cmodel_a, cmodel_b):
            # create a task with the given gt/model
            params = {"cmodel": model.file.path.encode(), "lmodel": lmodel.file.path.encode()}
            tid = ocrutils.get_new_task_id(path)
            args = (gt, outdir.encode(), params)
            kwargs = dict(task_id=tid, loglevel=60, retries=2)
            task = OcrTask(
                task_id=tid,
                user=request.user,
                batch=batch,
                project=request.session["project"],
                page_name=os.path.basename(path),
                task_type="compare",
                status="INIT",
                args=args,
                kwargs=kwargs,
            )
            task.save()
            asyncparams.append((args, kwargs))            

            # create a score record for this task
            score = OcrModelScore(
                comparison=comparison,
                ground_truth=gt,
                task=task,
                model=model,                
            )
            score.save()
    # launch all the tasks (as comparisons, not converts)
    publisher = ComparisonTask.get_publisher(connect_timeout=5)    
    try:
        for args, kwargs in asyncparams:
            ComparisonTask.apply_async(args=args, publisher=publisher, **kwargs)
    finally:
        publisher.close()
        publisher.connection.close()

    return HttpResponseRedirect("/training/comparison/%s/" % comparison.pk) 
    

@project_required
@login_required
def comparison(request, pk):
    """
    View details of a model comparison.
    """
    comparison = get_object_or_404(OcrModelScoreComparison, pk=pk)
    scores = comparison.modelscores.order_by("pk", "ground_truth", "model")
    ordered = {}
    for score in scores:
        if ordered.get(score.ground_truth.pk):
            ordered[score.ground_truth.pk].append(score)
        else:
            ordered[score.ground_truth.pk] \
                = [score.ground_truth.data["page"], score,]

    model_a = scores[0].model
    model_b = scores[1].model

    # this is really dodgy - total the scores for each model
    total_a = total_b = 0
    for i in range(0, len(scores)):
        if i % 2 == 0:
            total_a += scores[i].score or 0
        else:
            total_b += scores[i].score or 0
    if not total_a is None and not total_b is None:
        total_a /= len(scores) / 2
        total_b /= len(scores) / 2

    template = "training/comparison.html" if not request.is_ajax() \
            else "training/includes/comparison_details.html"
        
    context = dict(
        comparison=comparison,
        ordered=ordered,
        total_a=total_a,
        total_b=total_b,
    )
    return render_to_response(template, context,
            context_instance=RequestContext(request))





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

    

    
