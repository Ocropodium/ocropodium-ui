from django import forms
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.utils import simplejson as json
from ocradmin.presets.models import Preset
from ocradmin.core import generic_views as gv


class PresetForm(forms.ModelForm):
    """
        Base preset form
    """
    def __init__(self, *args, **kwargs):
        super(PresetForm, self).__init__(*args, **kwargs)
        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40        

    class Meta:
        model = Preset
        fields = ["name", "tags", "description", "public", "user", "data"]
        exclude = ["created_on", "updated_on"]
        widgets = dict(
                user=forms.HiddenInput()
        )


presetlist = gv.GenericListView.as_view(
        model=Preset,
        page_name="OCR Presets",
        fields=["name", "description", "user", "created_on"],)

presetcreate = gv.GenericCreateView.as_view(
        model=Preset,
        form_class=PresetForm,
        page_name="New OCR Preset",)

presetdetail = gv.GenericDetailView.as_view(
        model=Preset,
        page_name="OCR Preset",
        fields=["name", "description", "user", "public", "tags", "created_on",
            "updated_on",])

presetedit = gv.GenericEditView.as_view(
        model=Preset,
        form_class=PresetForm,
        page_name="Edit OCR Preset",)

presetdelete = gv.GenericDeleteView.as_view(
        model=Preset,
        page_name="Delete OCR Preset",
        success_url="/presets/list/",)

def createjson(request):
    """Create a preset and return JSON data"""
    data = request.POST.copy()
    data.update(dict(user=request.user.pk))
    form = PresetForm(data)
    print form.is_valid()
    if not form.is_valid():
        return HttpResponse(json.dumps(form.errors),
                mimetype="application/json")
    form.save()
    return HttpResponse(json.dumps(form.instance.slug),
            status=201, mimetype="application/json")

def data(request, slug):
    """Return the data for a given preset in JSON format"""
    preset = get_object_or_404(Preset, slug=slug)
    return HttpResponse(json.dumps(preset.data), mimetype="application/json")

def update_data(request, slug):
    """Update script data for a given script."""
    preset = get_object_or_404(Preset, slug=slug)
    scriptdata = request.POST.get("data", "")
    # TODO: Validate script data
    preset.data = scriptdata
    preset.save()
    return HttpResponse(json.dumps(preset.data), mimetype="application/json")

def download(request, slug):
    """Return the data for a preset as an attachment"""
    preset = get_object_or_404(Preset, slug=slug)
    response = HttpResponse(preset.data, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=%s.json" % slug
    return response

def fetch(request):
    """Hacky method of forcing downloading of an in-progress script via JS"""
    script = request.POST.get("script")
    response = HttpResponse(script, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=script.json"
    return response

