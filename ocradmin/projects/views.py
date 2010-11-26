import os
from datetime import datetime
from django import forms
from django.forms.models import inlineformset_factory
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core import serializers
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.core.serializers.json import DjangoJSONEncoder
from django.template.defaultfilters import slugify
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.template.defaultfilters import slugify
from django.utils import simplejson

from tagging.models import TaggedItem
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.batch.models import OcrBatch
from ocradmin.projects.models import OcrProject, OcrProjectDefaults
from fedora.adaptor import fcobject, fcdatastream
from ordereddict import OrderedDict
from ocradmin.projects.tasks import IngestTask
PER_PAGE = 10


class DeleteProjectForm(forms.Form):
    """
    Form to ensure the user really, really wants to
    delete an entire project.
    """
    confirm = forms.CharField()


class OcrProjectForm(forms.ModelForm):
    """
        New project form.
    """
    def __init__(self, *args, **kwargs):
        super(forms.ModelForm, self).__init__(*args, **kwargs)

        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40

    class Meta:
        model = OcrProject
        exclude = ["user", "slug", "created_on"]


class OcrProjectDefaultsForm(forms.ModelForm):
    """
    New project defaults form.
    """
    class Meta:
        model = OcrProjectDefaults


def project_query(user, order, **params):
    """
        Query the model set.
    """

    tag = params.get("tag")
    try:
        del params["tag"]
    except KeyError:
        pass

    query = Q()
    for key, val in params.items():
        if key.find("__") == -1 and \
                not key in OcrProject._meta.get_all_field_names():
            continue
        ld = {key: val}
        query = query & Q(**ld)

    # if there's a tag present search by tagged item
    if tag:
        return TaggedItem.objects.get_by_model(
            OcrProject.objects.filter(query),
            tag).order_by(*order)
    else:
        return OcrProject.objects.filter(query).order_by(*order)


@login_required
def index(request):
    """
    Redirect to the project list.
    """
    return list(request)


@login_required
def list(request):
    """
    List available projects.
    """
    tag = request.GET.get("tag")
    order = request.GET.get("order", "name")
    fields = ["name", "created_on", "user__pk"]
    # add a 'invert token' if we're ordering by the
    # same field again
    fields = map(lambda x: "-%s" % x if x == order else x, fields)
    context = dict(
        projects=project_query(request.user, [order, "created_on"], tag=tag),
        fields=fields,
        order=order
    )
    template = "projects/list.html" if not request.is_ajax() \
            else "projects/includes/project_list.html"

    return render_to_response(template, context,
            context_instance=RequestContext(request))


@login_required
def new(request):
    """
    Show a form for a new project.
    """
    form = OcrProjectForm()
    defform = OcrProjectDefaultsForm()
    context = {"form": form, "defform": defform}
    template = "projects/new.html" if not request.is_ajax() \
            else "projects/includes/project_form.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.autocommit
@login_required
def create(request):
    """
    Create a new project.
    """
    form = OcrProjectForm(request.POST)
    defform = OcrProjectDefaultsForm(request.POST)
    if not request.method == "POST" \
            or not defform.is_valid() or not form.is_valid():
        # if we get here there's an error
        context = {"form": form, "defform": defform}
        template = "projects/new.html"
        return render_to_response(template, context,
                context_instance=RequestContext(request))

    defaults = defform.save()
    project = form.instance
    project.defaults = defaults
    project.slug = slugify(project.name)
    project.user = request.user
    project.full_clean()
    project.save()
    return HttpResponseRedirect("/projects/load/%s/" % project.pk)


@login_required
def edit(request, pk):
    """
    Show a form for editing the project.
    """
    project = get_object_or_404(OcrProject, pk=pk)
    form = OcrProjectForm(instance=project)
    defform = OcrProjectDefaultsForm(instance=project.defaults)
    context = {"project": project, "form": form, "defform": defform}
    template = "projects/edit.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.autocommit
@login_required
def update(request, pk):
    """
    Update a project.
    """
    project = get_object_or_404(OcrProject, pk=pk)
    form = OcrProjectForm(request.POST, instance=project)
    defform = OcrProjectDefaultsForm(request.POST, instance=project.defaults)

    if request.method == "POST":
        if not defform.is_valid() or not form.is_valid():
            # if we get here there's an error
            context = {"project": project, "form": form, "defform": defform}
            template = "projects/edit.html"
            return render_to_response(template, context,
                    context_instance=RequestContext(request))
        defaults = defform.save()
        project = form.instance
        project.defaults = defaults
        project.slug = slugify(project.name)
        project.full_clean()
        project.save()
    return HttpResponseRedirect("/projects/list")


@login_required
def show(request, pk):
    """
    Show request details.
    """
    project = get_object_or_404(OcrProject, pk=pk)
    form = OcrProjectForm(instance=project)
    defform = OcrProjectDefaultsForm(instance=project)
    context = {"project": project, "form": form, "defform": defform}
    template = "projects/show.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@login_required
def open(request):
    """
    List available projects.
    """
    order = request.GET.getlist("order_by")
    params = request.GET.copy()
    projects = project_query(request.user, order, **params)

    serializer = serializers.get_serializer("json")()
    json = serializer.serialize(
        projects,
    )
    return HttpResponse(json, mimetype="application/json")


@login_required
def load(request, pk):
    """
    Open a project (load it in the session).
    """
    project = get_object_or_404(OcrProject, pk=pk)
    request.session["project"] = project
    return HttpResponseRedirect("/projects/show/%s/" % pk)


def close(request):
    """
    Close the current project.
    """
    try:
        del request.session["project"]
    except KeyError:
        pass
    return HttpResponseRedirect("/ocr/")


@login_required
def export(request, pk):
    """
    Export a project.
    """
    project = get_object_or_404(OcrProject, pk=pk)
    template = "projects/export.html" if not request.is_ajax() \
            else "projects/includes/export_form.html"
    dublincore = OrderedDict([(v, "") for v in \
            fcobject.FedoraObject.DUBLINCORE])
    dublincore["title"] = "<page_name>"
    dublincore["creator"] = request.user.get_full_name()
    dublincore["description"] = project.description
    dublincore["subject"] = project.name
    dublincore["date"] = datetime.today()

    context = dict(
        project=project,
        dublincore=dublincore
    )
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.commit_on_success
@login_required
def ingest(request, pk):
    """
    Ingest project training data into fedora.
    """
    project = get_object_or_404(OcrProject, pk=pk)
    if not request.method == "POST":
        return export(request)

    namespace = request.POST.get("fedora_namespace", slugify(project.name))
    dublincore = OrderedDict()
    for key, val in request.POST.iteritems():
        if key.startswith("dc_"):
            dublincore[key.replace("dc_", "", 1)] = val

    asyncparams = []

    # create a batch db job
    batch = OcrBatch(
        user=request.user,
        name="Fedora Ingest: %s" % namespace,
        description="",
        task_type=IngestTask.name,
        project=project
    )
    batch.save()

    for ts in project.reference_sets.all():
        tid = ocrutils.get_new_task_id()
        args = (ts.pk, namespace, dublincore)
        kwargs = dict(task_id=tid, queue="interactive")
        task = OcrTask(
            task_id=tid,
            user=request.user,
            batch=batch,
            project=project,
            page_name=os.path.basename(ts.page_name),
            task_name=IngestTask.name,
            status="INIT",
            args=args,
            kwargs=kwargs,
        )
        task.save()
        asyncparams.append((args, kwargs))

    # launch all the tasks
    publisher = IngestTask.get_publisher(connect_timeout=5)
    try:
        for args, kwargs in asyncparams:
            IngestTask.apply_async(args=args, publisher=publisher, **kwargs)
    finally:
        publisher.close()
        publisher.connection.close()

    return HttpResponseRedirect("/batch/show/%d/" % batch.pk)


@login_required
def confirm_delete_project(request, project_pk):
    """
    Confirm deletion of the current project.
    """
    project = get_object_or_404(OcrProject, pk=project_pk)
    form = DeleteProjectForm()
    template = "projects/delete.html" if not request.is_ajax() \
            else "projects/includes/delete_form.html"
    context = {"project": project, "form": form}
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@login_required
def delete_project(request, project_pk):
    """
    Delete a project.
    """
    project = get_object_or_404(OcrProject, pk=project_pk)
    form = DeleteProjectForm(request.POST)

    if not request.method == "POST" or not form.is_valid() \
            or not form.cleaned_data["confirm"] == "yes":
        messages.info(request, "Project '%s' was NOT deleted." % project.name)
    else:
        project.delete()
        messages.success(request, "Project '%s' deleted." % project.name)
    return HttpResponseRedirect("/projects/list")
