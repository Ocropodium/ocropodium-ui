"""
URLConf for OCR projects.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.projects import views

urlpatterns = patterns('',
	(r'^/?$', login_required(views.projectlist)),
    (r'^list/?$', login_required(views.projectlist)),
    (r'^create/?$', views.ProjectWizard(
            [views.ProjectForm, views.DummyStorageForm])),
    (r'^show/(?P<pk>\d+)/?$', login_required(views.projectdetail)),
    (r'^edit/(?P<pk>\d+)/?$', login_required(views.projectedit)),
    (r'^delete/(?P<pk>\d+)/?$', login_required(views.projectdelete)),
	(r'^open/?$', login_required(views.projectlist)),
	(r'^close/?$', login_required(views.close)),
	(r'^export/(?P<project_pk>\d+)/?$', login_required(views.export)),
	(r'^ingest/(?P<project_pk>\d+)/?$', login_required(views.ingest)),
	(r'^load/(?P<project_pk>\d+)/$', login_required(views.load)),
)
