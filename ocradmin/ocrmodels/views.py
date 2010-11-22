from django import forms
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.core import serializers
from django.db.models import Q
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.template import Template, Context
from django.template.loader import get_template

from tagging.models import TaggedItem

from ocradmin.ocrmodels import utils as ocrutils
from ocradmin.ocrmodels.models import OcrModel


class OcrModelForm(forms.ModelForm):
    """
        Base model form
    """
    ALLOWED_FILE_TYPES = ("application/octet-stream", "application/x-gzip", "application/x-compressed-tar") 
    def __init__(self, *args, **kwargs):
        super(OcrModelForm, self).__init__(*args, **kwargs)

        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40

    def clean_file(self):
        """
        Validate allowed data types.
        """
        data = self.cleaned_data["file"]
        if not data.content_type in self.ALLOWED_FILE_TYPES:
            raise forms.ValidationError(
                    "Bad file type: %s.  Must be one of: %s" % (data.content_type, ", ".join(self.ALLOWED_FILE_TYPES)))
        return data

    class Meta:
        model = OcrModel
        fields = ["name", "file", "description", "public", "app", "type", "tags",]
        exclude = ["user", "updated_on", "derived_from"]


class OcrModelEditForm(OcrModelForm):
    """
        Form for editing the few changable fields on an already
        existing model.
    """

    def __init__(self, *args, **kwargs):
        super(OcrModelEditForm, self).__init__(*args, **kwargs)

    class Meta:
        model = OcrModel
        fields = ["name", "description", "public", "tags", "app", "type",]
        exclude = ["user", "updated_on", "derived_from",]



def index(request):
    return list(request)


def model_query(user, order, **params):
    """
        Query the model set.
    """

    tag = params.get("tag")
    try:
        del params["tag"]
    except KeyError:
        pass

    query = Q(public=True) | (Q(public=False) & Q(user=user))
    for key, val in params.items():
        ld = {key:val}
        query = query & Q(**ld)

    # if there's a tag present search by tagged item
    if tag:
        return TaggedItem.objects.get_by_model(
            OcrModel.objects.filter(query),
            tag).order_by(*order)
    else:
        return OcrModel.objects.filter(query).order_by(*order)





@login_required
def list(request):
    """
        List OCR Models.
    """

    tag = request.GET.get("tag")
    order = request.GET.get("order", "name")
    fields = [ "name", "app", "type", ]
    # add a 'invert token' if we're ordering by the
    # same field again
    fields = map(lambda x: "-%s" % x if x == order else x, fields)
    context = dict(
        models=model_query(request.user, [order, "created_on"], tag=tag),
        fields=fields,
        order=order,
    )

    template = "ocrmodels/list.html" if not request.is_ajax() \
            else "ocrmodels/includes/model_list.html"

    return render_to_response(template, context, context_instance=RequestContext(request))


@login_required
def search(request):
    """
        Search specific model types.
    """
    qd = {}
    for key, val in request.GET.items():
        if key in ("app", "type"):
            qd[str(key)] = str(val)
    mods = model_query(request.user, ["name", "created_on"], tag=request.GET.get("tag"), **qd)
    return HttpResponse(serializers.serialize("json", mods), mimetype="application/json")



@login_required
def new(request):
    """
        Show the new model form.
    """

    form = OcrModelForm(initial={"user" : request.user.pk})
    context = {"form": form}
    template = "ocrmodels/new.html" if not request.is_ajax() \
            else "ocrmodels/includes/new_model_form.html"

    return render_to_response(template, context, context_instance=RequestContext(request))

    
@login_required
def create(request):
    """
        Create a new model.
    """
    form = OcrModelForm(request.POST, request.FILES)
    if not form.is_valid():
        context = {"form": form}        
        template = "ocrmodels/new.html" if not request.is_ajax() \
                else "ocrmodels/includes/new_model_form.html"
        return render_to_response(template, context, context_instance=RequestContext(request))

    model = form.instance #OcrCharModel(**form.cleaned_data)
    model.user = request.user
    model.full_clean()
    model.save()
    messages.success(request, "Model was uploaded successfully.")
    return HttpResponseRedirect("/ocrmodels/list")


@login_required
def delete(request, pk):
    """
        Delete a model.
    """
    
    model = get_object_or_404(OcrModel, pk=pk)
    if request.user.is_staff or model.user == request.user:
        model.delete()
        messages.success(request, "Model deleted OK.")
    else:
        messages.error(request, "Attempt to delete non-owned model!")
        
    template = "ocrmodels/list.html" if not request.is_ajax() \
            else "ocrmodels/includes/model_list.html"

    return HttpResponseRedirect("/ocrmodels/list")


@login_required
def show(request, pk):
    """
        Inspect a model object.
    """

    model = get_object_or_404(OcrModel, pk=pk)

    modelinfo = ""
    if model.app == "ocropus" and model.type == "char":
        modelinfo = ocrutils.get_ocropus_model_info(model.file.path)
    elif model.app == "tesseract":
        modelinfo = ocrutils.get_tesseract_model_info(model.file.path)

    context = {"model": model, "info": modelinfo}
    template = "ocrmodels/show.html" if not request.is_ajax() \
            else "ocrmodels/includes/show_model.html"
    return render_to_response(template, context, context_instance=RequestContext(request))



def edit(request, pk):
    """
        Allow editing a certain number of model fields.
    """

    model = get_object_or_404(OcrModel, pk=pk)
    form = OcrModelEditForm(instance=model)
    context = {"form" : form, "model": model}
    template = "ocrmodels/includes/edit_model_form.html" if request.is_ajax() \
            else "ocrmodels/edit.html"

    return render_to_response(template, context, context_instance=RequestContext(request))


def update(request, pk):
    """
        Update the model object's editable fields.
    """

    model = get_object_or_404(OcrModel, pk=pk)
    form = OcrModelEditForm(request.POST, request.FILES, instance=model)
    if not form.is_valid():
        # use the 202 status code to indicate that we need to send back
        # the incorrectly filled form...
        context = {"form": form}
        template = "ocrmodels/edit.html" if not request.is_ajax() \
                else "ocrmodels/includes/edit_model_form.html"
        return render_to_response(template, context, context_instance=RequestContext(request))

    if form.has_changed():
        model = form.instance 
        model.full_clean()
        model.save()
        messages.success(request, "Model was updated OK.")

    return HttpResponseRedirect("/ocrmodels/list") 
