"""
URLConf for OCR projects.
"""
from django.conf.urls.defaults import *
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.projects import views


urlpatterns = patterns('',
	(r'^/?$', views.projectlist),
    (r'^list/?$', views.projectlist),
    (r'^create/?$', login_required(views.projectcreate)),
    (r'^show/(?P<pk>\d+)/?$', views.projectdetail),
    (r'^edit/(?P<pk>\d+)/?$', login_required(views.projectedit)),
    (r'^delete/(?P<pk>\d+)/?$', login_required(views.projectdelete)),
	(r'^open/?$', views.projectlist),
	(r'^close/?$', views.close),
	(r'^export/(?P<project_pk>\d+)/?$', views.export),
	(r'^ingest/(?P<project_pk>\d+)/?$', views.ingest),
	(r'^load/(?P<project_pk>\d+)/$', views.load),
)
