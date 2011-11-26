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
from ocradmin.core import generic_views as gv


class OcrModelForm(forms.ModelForm):
    """
        Base model form
    """
    ALLOWED_FILE_TYPES = (
            "application/octet-stream",
            "application/x-gzip",
            "application/x-compressed-tar")

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
                    "Bad file type: %s.  Must be one of: %s" % (
                        data.content_type,
                        ", ".join(self.ALLOWED_FILE_TYPES)))
        return data

    class Meta:
        model = OcrModel
        fields = ["name", "file", "description",
                "public", "app", "type", "tags", "user"]
        exclude = ["updated_on", "derived_from"]
        widgets = dict(
                user=forms.HiddenInput()
        )


class OcrModelEditForm(OcrModelForm):
    """
        Form for editing the few changable fields on an already
        existing model.
    """

    def __init__(self, *args, **kwargs):
        super(OcrModelEditForm, self).__init__(*args, **kwargs)

    class Meta:
        model = OcrModel
        fields = ["name", "description", "public", "tags", "app", "type"]
        exclude = ["user", "updated_on", "derived_from"]


modellist = gv.GenericListView.as_view(
        model=OcrModel,
        page_name="OCR Models",
        fields=["name", "description", "user", "created_on"],)

modelcreate = gv.GenericCreateView.as_view(
        model=OcrModel,
        enctype="multipart/form-data",
        form_class=OcrModelForm,
        page_name="New OCR Model",)

modeldetail = gv.GenericDetailView.as_view(
        model=OcrModel,
        page_name="OCR Model",
        fields=["name", "description", "type", "app", "user", "public",
            "file", "derived_from", "tags", "created_on",
            "updated_on",])

modeledit = gv.GenericEditView.as_view(
        model=OcrModel,
        enctype="multipart/form-data",
        form_class=OcrModelEditForm,
        page_name="Edit OCR Model",)

modeldelete = gv.GenericDeleteView.as_view(
        model=OcrModel,
        page_name="Delete OCR Model",
        success_url="/ocrmodels/list/",)



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
        ld = {key: val}
        query = query & Q(**ld)

    # if there's a tag present search by tagged item
    if tag:
        return TaggedItem.objects.get_by_model(
            OcrModel.objects.filter(query),
            tag).order_by(*order)
    else:
        return OcrModel.objects.filter(query).order_by(*order)


@login_required
def search(request):
    """
        Search specific model types.
    """
    qd = {}
    for key, val in request.GET.items():
        if key in ("app", "type"):
            qd[str(key)] = str(val)
    mods = model_query(request.user, ["name", "created_on"],
            tag=request.GET.get("tag"), **qd)
    return HttpResponse(serializers.serialize("json", mods),
            mimetype="application/json")


