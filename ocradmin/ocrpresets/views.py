from django import forms
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from ocradmin.ocrpresets.models import OcrPreset


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


def data(request, pk):
    import json
    """Return the data for a given preset in JSON format"""
    preset = get_object_or_404(OcrPreset, pk=pk)
    return HttpResponse(json.dumps(preset.data), mimetype="application/json")


