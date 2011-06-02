from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.ocrmodels import views
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.core import generic_views as gv


modellist = gv.GenericListView.as_view(
        model=OcrModel,
        page_name="OCR Models",
        fields=["name", "description", "user", "created_on"],)

modelcreate = gv.GenericCreateView.as_view(
        model=OcrModel,
        enctype="multipart/form-data",
        form_class=views.OcrModelForm,
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
        form_class=views.OcrModelEditForm,
        page_name="Edit OCR Model",)

modeldelete = gv.GenericDeleteView.as_view(
        model=OcrModel,
        page_name="Delete OCR Model",
        success_url="/ocrmodels/list/",)


urlpatterns = patterns('',
   (r'^/?$', modellist),
	(r'^list/?$', modellist),
	(r'^show/(?P<pk>\d+)/$', modeldetail),
	(r'^create/?$', login_required(modelcreate)),
	(r'^edit/(?P<pk>\d+)/$', login_required(modeledit)),
	(r'^delete/(?P<pk>\d+)/$', login_required(modeldelete)),
	(r'^search$', 'ocradmin.ocrmodels.views.search'),
)
