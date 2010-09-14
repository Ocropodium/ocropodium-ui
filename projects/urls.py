from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^/?$', 'ocradmin.projects.views.index'),
	(r'^close/?$', 'ocradmin.projects.views.close'),
	(r'^create/?$', 'ocradmin.projects.views.create'),
	(r'^delete/(?P<pk>\d+)/$', 'ocradmin.projects.views.delete'),
	(r'^edit/(?P<pk>\d+)/$', 'ocradmin.projects.views.edit'),
	(r'^export/(?P<pk>\d+)/?$', 'ocradmin.projects.views.export'),
	(r'^ingest/(?P<pk>\d+)/?$', 'ocradmin.projects.views.ingest'),
	(r'^list/?$', 'ocradmin.projects.views.list'),
	(r'^load/(?P<pk>\d+)/$', 'ocradmin.projects.views.load'),
	(r'^new/?$', 'ocradmin.projects.views.new'),
	(r'^open/?$', 'ocradmin.projects.views.open'),
	(r'^show/(?P<pk>\d+)/$', 'ocradmin.projects.views.show'),
    (r'^update/(?P<pk>\d+)/$', 'ocradmin.projects.views.update'),
)
