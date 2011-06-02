"""
URLConf for OCR projects.
"""
from django.conf.urls.defaults import *
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.projects import views
from ocradmin.projects.models import OcrProject
from ocradmin.core import generic_views as gv


projectlist = gv.GenericListView.as_view(
        model=OcrProject,
        page_name="OCR Projects",
        fields=["name", "description", "user", "created_on"],)

projectcreate = gv.GenericCreateView.as_view(
        model=OcrProject,
        form_class=views.OcrProjectForm,
        page_name="New OCR Project",
        success_url="/projects/load/%(id)s/",)

projectdetail = gv.GenericDetailView.as_view(
        model=OcrProject,
        template_name="projects/show.html",
        page_name="OCR Project",
        fields=["name", "description", "user", "tags", "created_on",
            "updated_on",])

projectedit = gv.GenericEditView.as_view(
        model=OcrProject,
        form_class=views.OcrProjectForm,
        page_name="Edit OCR Project",
        success_url="/projects/load/%(id)s/",)

projectdelete = gv.GenericDeleteView.as_view(
        model=OcrProject,
        page_name="Delete OCR Project",
        success_url="/projects/list/",)





urlpatterns = patterns('',
	(r'^/?$', projectlist),
    (r'^list/?$', projectlist),
    (r'^create/?$', login_required(projectcreate)),
    (r'^show/(?P<pk>\d+)/?$', projectdetail),
    (r'^edit/(?P<pk>\d+)/?$', login_required(projectedit)),
    (r'^delete/(?P<pk>\d+)/?$', login_required(projectdelete)),
	(r'^open/?$', projectlist),
	(r'^close/?$', 'ocradmin.projects.views.close'),
	(r'^export/(?P<project_pk>\d+)/?$', 'ocradmin.projects.views.export'),
	(r'^ingest/(?P<project_pk>\d+)/?$', 'ocradmin.projects.views.ingest'),
	(r'^load/(?P<project_pk>\d+)/$', 'ocradmin.projects.views.load'),
)
