"""
URLConf for OCR presets.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.ocrpresets import views
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.core import generic_views as gv


presetlist = gv.GenericListView.as_view(
        model=OcrPreset,
        page_name="OCR Presets",
        fields=["name", "description", "user", "created_on"],)

presetcreate = gv.GenericCreateView.as_view(
        model=OcrPreset,
        form_class=views.OcrPresetForm,
        page_name="New OCR Preset",)

presetdetail = gv.GenericDetailView.as_view(
        model=OcrPreset,
        page_name="OCR Preset",
        fields=["name", "description", "user", "public", "tags", "created_on",
            "updated_on",])

presetedit = gv.GenericEditView.as_view(
        model=OcrPreset,
        form_class=views.OcrPresetForm,
        page_name="Edit OCR Preset",)

presetdelete = gv.GenericDeleteView.as_view(
        model=OcrPreset,
        page_name="Delete OCR Preset",
        success_url="/ocrpresets/list/",)

urlpatterns = patterns('',
    (r'^list/?$', presetlist),
    (r'^create/?$', login_required(presetcreate)),
    (r'^show/(?P<pk>\d+)/?$', presetdetail),
    (r'^edit/(?P<pk>\d+)/?$', login_required(presetedit)),
    (r'^delete/(?P<pk>\d+)/?$', login_required(presetdelete)),
    (r'^data/(?P<pk>\d+)/?$', views.data),
)
