from django import forms
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.utils import simplejson as json
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.core import generic_views as gv


class OcrPresetForm(forms.ModelForm):
    """
        Base preset form
    """
    def __init__(self, *args, **kwargs):
        super(OcrPresetForm, self).__init__(*args, **kwargs)
        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40        

    class Meta:
        model = OcrPreset
        fields = ["name", "tags", "description", "public", "user", "data"]
        exclude = ["created_on", "updated_on"]
        widgets = dict(
                user=forms.HiddenInput()
        )


presetlist = gv.GenericListView.as_view(
        model=OcrPreset,
        page_name="OCR Presets",
        fields=["name", "description", "user", "created_on"],)

presetcreate = gv.GenericCreateView.as_view(
        model=OcrPreset,
        form_class=OcrPresetForm,
        page_name="New OCR Preset",)

presetdetail = gv.GenericDetailView.as_view(
        model=OcrPreset,
        page_name="OCR Preset",
        fields=["name", "description", "user", "public", "tags", "created_on",
            "updated_on",])

presetedit = gv.GenericEditView.as_view(
        model=OcrPreset,
        form_class=OcrPresetForm,
        page_name="Edit OCR Preset",)

presetdelete = gv.GenericDeleteView.as_view(
        model=OcrPreset,
        page_name="Delete OCR Preset",
        success_url="/ocrpresets/list/",)

def data(request, slug):
    """Return the data for a given preset in JSON format"""
    preset = get_object_or_404(OcrPreset, slug=slug)
    return HttpResponse(json.dumps(preset.data), mimetype="application/json")

def download(request, slug):
    """Return the data for a preset as an attachment"""
    preset = get_object_or_404(OcrPreset, slug=slug)
    response = HttpResponse(preset.data, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=%s.json" % slug
    return response

def fetch(request):
    """Hacky method of forcing downloading of an in-progress script via JS"""
    script = request.POST.get("script")
    response = HttpResponse(script, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=script.json"
    return response

