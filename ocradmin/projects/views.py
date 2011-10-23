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
from ocradmin.batch.models import Batch
from ocradmin.projects.models import Project
from ocradmin.core import generic_views as gv


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




class ProjectForm(forms.ModelForm):
    """
        New project form.
    """
    def __init__(self, *args, **kwargs):
        super(forms.ModelForm, self).__init__(*args, **kwargs)

        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40

    class Meta:
        model = Project
        exclude = ["slug", "created_on"]
        widgets = dict(
                user=forms.HiddenInput(),
        )


projectlist = gv.GenericListView.as_view(
        model=Project,
        page_name="OCR Projects",
        fields=["name", "description", "user", "created_on"],)

projectcreate = gv.GenericCreateView.as_view(
        model=Project,
        form_class=ProjectForm,
        page_name="New OCR Project",
        success_url="/projects/load/%(id)s/",)

projectdetail = gv.GenericDetailView.as_view(
        model=Project,
        template_name="projects/show.html",
        page_name="OCR Project",
        fields=["name", "description", "user", "tags", "created_on",
            "updated_on",])

projectedit = gv.GenericEditView.as_view(
        model=Project,
        form_class=ProjectForm,
        page_name="Edit OCR Project",
        success_url="/projects/load/%(id)s/",)

projectdelete = gv.GenericDeleteView.as_view(
        model=Project,
        page_name="Delete OCR Project",
        success_url="/projects/list/",)



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
                not key in Project._meta.get_all_field_names():
            continue
        ldata = {key: val}
        query = query & Q(**ldata)

    # if there's a tag present search by tagged item
    if tag:
        return TaggedItem.objects.get_by_model(
            Project.objects.filter(query),
            tag).order_by(*order)
    else:
        return Project.objects.filter(query).order_by(*order)


@login_required
def load(request, project_pk):
    """
    Open a project (load it in the session).
    """
    project = get_object_or_404(Project, pk=project_pk)
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
    project = get_object_or_404(Project, pk=project_pk)
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
    project = get_object_or_404(Project, pk=project_pk)
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
    batch = Batch(
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

