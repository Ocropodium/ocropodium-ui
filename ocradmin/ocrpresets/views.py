from django import forms
from django.views.generic import ListView, FormView
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
        fields = ["name", "tags", "description", "public", "data"]
        exclude = ["user", "created_on", "updated_on"]


class PresetListView(ListView):
    paginate_by = 20
    fields=["name", "description", "user", "created_on"]

    def get_queryset(self):        
        order = self.request.GET.get("order", self.fields[0])
        return OcrPreset.objects.all().order_by(order)

    def get_context_data(self, **kwargs):
        context = super(PresetListView, self).get_context_data(**kwargs)
        context.update(
            page_name="OCR Presets",
            fields=self.fields,
            order=self.request.GET.get("order", self.fields[0])
        )
        return context


class PresetEditView(FormView):
    form_class = OcrPresetForm
    template_name = "generic_edit.html"

    def get_context_data(self, **kwargs):
        context = super(PresetEditView, self).get_context_data(**kwargs)
        context.update(
            page_name="OCR Presets",
        )
        return context



