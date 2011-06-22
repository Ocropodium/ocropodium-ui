from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.ocrmodels import views

urlpatterns = patterns('',
   (r'^/?$', views.modellist),
	(r'^list/?$', views.modellist),
	(r'^show/(?P<pk>\d+)/$', views.modeldetail),
	(r'^create/?$', login_required(views.modelcreate)),
	(r'^edit/(?P<pk>\d+)/$', login_required(views.modeledit)),
	(r'^delete/(?P<pk>\d+)/$', login_required(views.modeldelete)),
	(r'^search$', views.search),
)
