from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^/?$', 'ocradmin.projects.views.index'),
	(r'^list/?$', 'ocradmin.projects.views.list'),
	(r'^new/?$', 'ocradmin.projects.views.new'),
	(r'^close/?$', 'ocradmin.projects.views.close'),
	(r'^create/?$', 'ocradmin.projects.views.create'),
	(r'^export/(?P<pk>\d+)/?$', 'ocradmin.projects.views.export'),
	(r'^ingest/(?P<pk>\d+)/?$', 'ocradmin.projects.views.ingest'),
	(r'^show/(?P<pk>\d+)/$', 'ocradmin.projects.views.show'),
	(r'^edit/(?P<pk>\d+)/$', 'ocradmin.projects.views.edit'),
	(r'^load/(?P<pk>\d+)/$', 'ocradmin.projects.views.load'),
	(r'^open/?$', 'ocradmin.projects.views.open'),
    (r'^update/(?P<pk>\d+)/$', 'ocradmin.projects.views.update'),
)
