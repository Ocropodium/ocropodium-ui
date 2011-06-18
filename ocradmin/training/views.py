import os
from datetime import datetime
from ordereddict import OrderedDict

from django.core.files.base import ContentFile
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction, IntegrityError
from django.db.models import Q, Count
from django.http import HttpResponse, HttpResponseRedirect, \
        HttpResponseServerError
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from django import forms
from ocradmin.core import utils as ocrutils
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrtasks.models import OcrTask, OcrBatch
from ocradmin.training.models import OcrComparison, ParameterScore
from ocradmin.reference_pages.models import ReferencePage
from ocradmin.core.decorators import project_required, saves_files
from ocradmin.training.tasks import LineTrainTask, ComparisonTask
from ocradmin.presets.models import Preset

class ReferenceSetForm(forms.Form):
    """
    Form for submitting a new training set.
    """
    name = forms.CharField()
    cmodel = forms.ModelChoiceField(
            queryset=OcrModel.objects.filter(type="char", app="ocropus"))
    notes = forms.CharField(required=False)


class ComparisonForm(forms.Form):
    """
    Form for submitting a new comparison job.
    """
    name = forms.CharField()
    notes = forms.CharField(required=False, widget=forms.widgets.Textarea())

    def __init__(self, *args, **kwargs):
        super(forms.Form, self).__init__(*args, **kwargs)

        # change a widget attribute:
        self.fields['notes'].widget.attrs["rows"] = 2
        self.fields['notes'].widget.attrs["cols"] = 40


def comparison_query(order, **params):
    """
        Query the comparison set.
    """

    try:
        del params["tag"]
    except KeyError:
        pass

    query = Q()
    for key, val in params.items():
        ld = {key: val}
        query = query & Q(**ld)

    # if there's a tag present search by tagged item
    return OcrComparison.objects\
            .filter(query)\
            .order_by(*order)\
            .annotate(groundtruths=Count("parameter_scores__ground_truth"))


@project_required
@login_required
def new(request):
    """
    Show a new training task form.
    """
    # initialize the training set name
    project = request.session["project"]
    trainnum = project.tasks.filter(task_name="cmodel.training").count() + 1
    name = "%s Training %d" % (project.name, trainnum)

    template = "training/new.html"
    context = dict(
        form=ReferenceSetForm(initial=dict(name=name)),
        project=request.session["project"],
        tsets=request.session["project"].reference_sets.all(),
    )
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@project_required
@login_required
@saves_files
def create(request):
    """
    Create a new training task.
    """
    project = request.session["project"]
    form = ReferenceSetForm(request.POST)
    formok = form.is_valid()
    try:
        tsets = ReferencePage.objects.filter(
                pk__in=request.POST.getlist("tset"))
    except ReferencePage.DoesNotExist:
        formok = False

    if not formok:
        template = "training/new.html"
        context = dict(
            form=form,
            tsets=project.reference_sets.all(),
            project=project,
        )
        return render_to_response(template, context,
                context_instance=RequestContext(request))

    name = form.cleaned_data["name"]
    cmodel = form.cleaned_data["cmodel"]

    # make us a new task entry
    tid = OcrTask.get_new_task_id()
    args = ([t.pk for t in tsets], cmodel.pk, request.output_path)
    # Note: could add a 'queue' param here
    kwargs = dict(task_id=tid, loglevel=60, retries=2,)
    task = OcrTask(
        task_id=tid,
        user=request.user,
        project=project,
        page_name=name,
        task_name="train",
        status="INIT",
        args=args,
        kwargs=kwargs,
    )
    task.save()
    LineTrainTask.apply_async(args=args, **kwargs)

    return HttpResponseRedirect("/ocrtasks/list")


@project_required
@login_required
def compare(request):
    """
    Show a form allowing the user to
    submit a job comparing the results
    of two cmodels on a training set.
    """
    template = "training/compare.html"
    return render_to_response(template, _get_comparison_context(request),
            context_instance=RequestContext(request))


@transaction.commit_on_success
@project_required
@saves_files
@login_required
def score_models(request):
    """
    Run a comparison between two sets of OCR parameters.
    """

    taskname = "run.batchitem"
    form = ComparisonForm(request.POST)
    project = request.session["project"]

    try:
        tsets = ReferencePage.objects.filter(
                pk__in=request.POST.getlist("tset"))
        assert(tsets)
        assert(form.is_valid())
    except (ReferencePage.DoesNotExist, AssertionError):
        template = "training/compare.html"
        return render_to_response(template, _get_comparison_context(request),
                context_instance=RequestContext(request))
    # create a batch db job
    scripts = []
    scriptnum = 1
    while True:
        data = request.POST.get("script%d" % scriptnum)
        if data is None:
            break
        scripts.append(Preset.objects.get(
                slug=request.POST.get("script%d" % scriptnum)))
        scriptnum += 1
    print request.POST
    print tsets
    print scripts
    
    batch = OcrBatch(
        user=request.user,
        name="Model Scoring %s" % datetime.now(),
        description="",
        task_type=ComparisonTask.name,
        project=request.session["project"]
    )
    batch.save()

    comparison = OcrComparison(
        name=form.cleaned_data["name"],
        notes=form.cleaned_data["notes"],
        batch=batch,
    )
    comparison.save()

    ocrtasks = []
    for script in scripts:
        for gtruth in tsets:
            path = gtruth.source_image.path
            tid = OcrTask.get_new_task_id()
            callback = ComparisonTask.subtask(args=(gtruth.pk,))
            args = (path, script.data, request.output_path)
            kwargs = dict(callback=callback, task_id=tid, loglevel=60, retries=2)
            ocrtask = OcrTask(
                task_id=tid,
                user=request.user,
                batch=batch,
                project=request.session["project"],
                page_name=os.path.basename(path),
                task_name=taskname,
                status="INIT",
                args=args,
                kwargs=kwargs,
            )
            ocrtask.save()
            ocrtasks.append(ocrtask)

            # create a score record for this task
            score = ParameterScore(
                name=script.name,
                task=ocrtask,
                comparison=comparison,
                ground_truth=gtruth
            )
            score.save()
    try:
        # ignoring the result for now
        OcrTask.run_celery_task_multiple(taskname, ocrtasks)
    except StandardError:
        transaction.rollback()
        raise
    transaction.commit()
    return HttpResponseRedirect("/batch/show/%s/" % batch.pk)


@project_required
@login_required
def comparison_from_batch(request):
    """
    View details of a model comparison.
    """
    batch = get_object_or_404(OcrBatch, pk=request.GET.get("batch", 0))
    try:
        cpk = batch.ocrcomparison.pk
    except OcrComparison.DoesNotExist:
        cpk = 0
    return comparison(request, cpk)


@project_required
@login_required
def comparison(request, comparison_pk):
    """
    View details of a model comparison.
    """
    comparison = get_object_or_404(OcrComparison, pk=comparison_pk)
    scores = comparison.parameter_scores.order_by("pk", "name", "ground_truth")

    # this is really dodgy - total the scores for each model
    totals = OrderedDict()
    counts = OrderedDict()
    for score in scores:
        if not totals.get(score.name):
            totals[score.name] = 0
            counts[score.name] = 0
        if not score.score is None:
            totals[score.name] += score.score
            counts[score.name] += 1

    for name, score in totals.iteritems():
        if counts[name] > 0:
            totals[name] /= counts[name]

    template = "training/comparison.html" if not request.is_ajax() \
            else "training/includes/comparison_details.html"

    context = dict(
        comparison=comparison,
        scores=scores,
        totals=totals,
    )
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@project_required
@login_required
def show_paramscore(request, paramscore_pk):
    """
    Display the accuracy internals of a model score.
    """
    score = get_object_or_404(ParameterScore, pk=paramscore_pk)
    result = score.task.latest_transcript()
    context = dict(
        modelscore=score,
        task=score.task,
        text=ocrutils.output_to_text(result),
        json=result
    )
    template = "training/show_modelscore.html" if not request.is_ajax() \
            else "training/includes/modelscore.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@project_required
@login_required
def comparisons(request):
    """
    List the Model comparisons.
    """
    order = request.GET.get("order", "created_on")
    fields = ["name", "created_on", "groundtruths"]
    # add a 'invert token' if we're ordering by the
    # same field again
    fields = map(lambda x: "-%s" % x if x == order else x, fields)
    context = dict(
        comparisons=comparison_query([order, "created_on"]),
        fields=fields,
        order=order,
    )
    template = "training/comparisons.html" if not request.is_ajax() \
            else "training/includes/comparison_list.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))



def _get_comparison_context(request):
    """
    Get the context for rendering the compare form.
    """
    return dict(
        form=ComparisonForm(initial={"name": "Parameter Comparison"}),
        presets=Preset.objects.all().order_by("name"),
        project=request.session["project"],
        tsets=request.session["project"].reference_sets.all(),
    )
