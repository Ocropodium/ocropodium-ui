from django import forms
from django.forms.models import inlineformset_factory
from django.contrib.auth.decorators import login_required
from django.core import serializers
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson

from tagging.models import TaggedItem
from ocradmin.projects.models import OcrProject, OcrProjectDefaults


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
        exclude = ["user", "created_on"]


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
        ld = {key:val}
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
    fields = [ "name", "created_on", "user__pk", ]
    # add a 'invert token' if we're ordering by the
    # same field again
    fields = map(lambda x: "-%s" % x if x == order else x, fields)
    context = {
        "projects" : project_query(request.user, [order, "created_on"], tag=tag),
        "fields" : fields,
    }
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
    template = "projects/new.html"
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
    if request.method == "POST":        
        if not defform.is_valid() or not form.is_valid():
            if not defform.is_valid():
                print "Default Form invalid!"
                print defform.errors
            # if we get here there's an error
            context = {"form": form, "defform": defform}
            template = "projects/new.html"
            return render_to_response(template, context,
                    context_instance=RequestContext(request))
        print "Trying to save forms"
        defaults = defform.save()
        project = form.instance
        project.defaults = defaults
        project.user = request.user
        project.full_clean()
        project.save()
    return HttpResponseRedirect("/projects/list")



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
            print "Forms invalid!"
            # if we get here there's an error
            context = {"project": project, "form": form, "defform": defform}
            template = "projects/edit.html"
            return render_to_response(template, context,
                    context_instance=RequestContext(request))
        print "Trying to save forms"
        defaults = defform.save()
        project = form.instance
        project.defaults = defaults
        project.full_clean()
        project.save()
    return HttpResponseRedirect("/projects/list")


@login_required
def show(request, pk):
    """
    Show request details.
    """
    project = get_object_or_404(OcrProject, pk=pk)
    context = {"project": project}
    template = "projects/show.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))





