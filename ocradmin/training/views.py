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
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocr.utils import saves_files
from ocradmin.ocr.views import _get_best_params
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrtasks.models import OcrTask, OcrBatch
from ocradmin.training.models import OcrComparison, ParameterScore
from ocradmin.reference_pages.models import ReferencePage
from ocradmin.projects.utils import project_required
from ocradmin.training.tasks import LineTrainTask, ComparisonTask
from ocradmin.ocr.tools.manager import PluginManager


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
    tid = ocrutils.get_new_task_id()
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

    asyncparams = []
    # create a batch db job
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

    # get parameter sets
    psetnames = _get_paramset_names(request.POST)
    paramsets = _get_paramset_list(request.POST)
    assert(len(psetnames) == len(paramsets))

    for gtruth in tsets:
        path = gtruth.source_image.path
        for i in range(len(paramsets)):
            params = paramsets[i]
            tid = ocrutils.get_new_task_id(path)
            args = (gtruth.pk, request.output_path.encode(), params)
            kwargs = dict(task_id=tid, loglevel=60, retries=2)
            task = OcrTask(
                task_id=tid,
                user=request.user,
                batch=batch,
                project=request.session["project"],
                page_name="%s" % os.path.basename(os.path.splitext(path)[0]),
                task_name=ComparisonTask.name,
                status="INIT",
                args=args,
                kwargs=kwargs,
            )
            task.save()
            asyncparams.append((args, kwargs))

            # create a score record for this task
            score = ParameterScore(
                name=psetnames[i],
                task=task,
                comparison=comparison,
                ground_truth=gtruth
            )
            score.save()
    # launch all the tasks (as comparisons, not converts)
    publisher = ComparisonTask.get_publisher(connect_timeout=5)
    try:
        for args, kwargs in asyncparams:
            ComparisonTask.apply_async(
                    args=args, publisher=publisher, **kwargs)
    finally:
        publisher.close()
        publisher.connection.close()
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


def _get_paramset_list(postdict):
    """
    Parse sets of distinct params from the POST data.
    They all have a prefix p0_ .. pN_
    """
    paramsets = []
    pinit = 0
    while True:
        params = _get_best_params(postdict, with_prefix="p%d_" % pinit)
        if len(params) == 0:
            break
        paramsets.append(params)
        pinit += 1
    return paramsets


def _get_paramset_names(postdict):
    """
    Extract names for each of the paramsets from the POST data.
    Again, they have the prefix p0_ .. pN_
    """
    paramnames = []
    pinit = 0
    while True:
        name = postdict.get("p%d_paramset_name" % pinit)
        if not name:
            break
        paramnames.append(name)
        pinit += 1
    return paramnames


def _get_comparison_context(request):
    """
    Get the context for rendering the compare form.
    """
    return dict(
        form=ComparisonForm(initial={"name": "Parameter Comparison"}),
        prefixes=["p0_", "p1_"],
        project=request.session["project"],
        binpresets=OcrPreset.objects.filter(type="binarize").order_by("name"),
        segpresets=OcrPreset.objects.filter(type="segment").order_by("name"),
        engines=PluginManager.get_provider("line"),
        tsets=request.session["project"].reference_sets.all(),
    )
