"""
Project-related view functions.
"""

import os
from datetime import datetime
from django import forms
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core import serializers
from django.template.defaultfilters import slugify
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.template.defaultfilters import slugify

from tagging.models import TaggedItem
from ocradmin.core import utils as ocrutils
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.batch.models import OcrBatch
from ocradmin.projects.models import OcrProject
from fedora.adaptor import fcobject
from ordereddict import OrderedDict
PER_PAGE = 10


class ExportForm(forms.Form):
    """
    Fedora Export form.
    """
    username = forms.CharField(max_length=50)
    password = forms.CharField(max_length=255,
            widget=forms.PasswordInput(render_value=False))
    repository_url = forms.CharField(max_length=255)
    namespace = forms.CharField(max_length=255)


class DublinCoreForm(forms.Form):
    """
    Dublin Core Metadata form.
    """
    title = forms.CharField(max_length=255)
    creator = forms.CharField(max_length=255)
    subject = forms.CharField(max_length=255)
    description = forms.CharField(max_length=255, required=False)
    publisher = forms.CharField(max_length=255, required=False)
    contributors = forms.CharField(max_length=255, required=False)
    date = forms.DateField(required=False)
    type = forms.CharField(max_length=255, required=False)
    format = forms.CharField(max_length=255, required=False)
    identifier = forms.CharField(max_length=255, required=False)
    source = forms.CharField(max_length=255, required=False)
    language = forms.CharField(max_length=255, required=False)
    relation = forms.CharField(max_length=255, required=False)
    coverage = forms.CharField(max_length=255, required=False)
    right = forms.CharField(max_length=255, required=False)




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
        ldata = {key: val}
        query = query & Q(**ldata)

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
    fields = ["-%s" % x if x == order else x for x in fields]
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
    context = {"form": form}
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
    if not request.method == "POST" or not form.is_valid():
        # if we get here there's an error
        context = {"form": form}
        template = "projects/new.html"
        return render_to_response(template, context,
                context_instance=RequestContext(request))

    project = form.instance
    project.slug = slugify(project.name)
    project.user = request.user
    project.full_clean()
    project.save()
    return HttpResponseRedirect("/projects/load/%s/" % project.pk)


@login_required
def edit(request, project_pk):
    """
    Show a form for editing the project.
    """
    project = get_object_or_404(OcrProject, pk=project_pk)
    form = OcrProjectForm(instance=project)
    context = {"project": project, "form": form,}
    template = "projects/edit.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.autocommit
@login_required
def update(request, project_pk):
    """
    Update a project.
    """
    project = get_object_or_404(OcrProject, pk=project_pk)
    form = OcrProjectForm(request.POST, instance=project)

    if request.method == "POST":
        if not form.is_valid():
            # if we get here there's an error
            context = {"project": project, "form": form,}
            template = "projects/edit.html"
            return render_to_response(template, context,
                    context_instance=RequestContext(request))
        project = form.instance
        project.slug = slugify(project.name)
        project.full_clean()
        project.save()
    return HttpResponseRedirect("/projects/list")


@login_required
def show(request, project_pk):
    """
    Show request details.
    """
    project = get_object_or_404(OcrProject, pk=project_pk)
    form = OcrProjectForm(instance=project)
    context = {"project": project, "form": form,}
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
def load(request, project_pk):
    """
    Open a project (load it in the session).
    """
    project = get_object_or_404(OcrProject, pk=project_pk)
    request.session["project"] = project
    return HttpResponseRedirect("/projects/show/%s/" % project_pk)


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
def export(request, project_pk):
    """
    Export a project.
    """
    project = get_object_or_404(OcrProject, pk=project_pk)
    template = "projects/export.html" if not request.is_ajax() \
            else "projects/includes/export_form.html"

    exportform, dcform = _get_default_export_forms(request, project)
    context = dict(
        project=project,
        exportform=exportform,
        dcform=dcform,
    )
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@transaction.commit_on_success
@login_required
def ingest(request, project_pk):
    """
    Ingest project training data into fedora.
    """
    taskname = "fedora.ingest"
    project = get_object_or_404(OcrProject, pk=project_pk)
    template = "projects/export.html" if not request.is_ajax() \
            else "projects/includes/export_form.html"
    exportform = ExportForm(request.POST)
    dcform = DublinCoreForm(request.POST)
    if not request.method == "POST" or not exportform.is_valid() \
            or not dcform.is_valid():
        context = dict(exportform=exportform, dcform=dcform,
                project=project)
        return render_to_response(template, context,
                context_instance=RequestContext(request))

    # get all-string dublincore data
    dc = dict([(k, str(v)) for k, v in dcform.cleaned_data.iteritems()])

    # create a batch db job
    batch = OcrBatch(
        user=request.user,
        name="Fedora Ingest: %s" % exportform.cleaned_data.get("namespace"),
        description="",
        task_type=taskname,
        project=project
    )
    batch.save()

    ingesttasks = []
    for rset in project.reference_sets.all():
        tid = OcrTask.get_new_task_id()
        args = (rset.pk, exportform.cleaned_data, dc)
        kwargs = dict(task_id=tid, queue="interactive")
        task = OcrTask(
            task_id=tid,
            user=request.user,
            batch=batch,
            project=project,
            page_name=os.path.basename(rset.page_name),
            task_name=taskname,
            status="INIT",
            args=args,
            kwargs=kwargs,
        )
        task.save()
        ingesttasks.append(task)

    # launch all the tasks
    OcrTask.run_celery_task_multiple(taskname, ingesttasks)
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


def _get_default_export_forms(request, project):
    """
    Fill in default values for DC.
    """
    exportform = ExportForm(initial=dict(
        username="fedoraAdmin",
        password="fedora",
        repository_url="http://localhost:8080/fedora/",
        namespace=project.slug,
    ))
    dcform = DublinCoreForm(initial=dict(
        title="<page_name>",
        creator=request.user.get_full_name(),
        description=project.description,
        subject=project.name,
        date=datetime.today(),
    ))
    return exportform, dcform

