from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^create/?$', 'ocradmin.ocrpresets.views.create'),
	(r'^data/(?P<pk>\d+)/$', 'ocradmin.ocrpresets.views.data'),
	(r'^delete/(?P<pk>\d+)/$', 'ocradmin.ocrpresets.views.delete'),
	(r'^edit/(?P<pk>\d+)/$', 'ocradmin.ocrpresets.views.edit'),
	(r'^list/?$', 'ocradmin.ocrpresets.views.list'),
	(r'^new/?$', 'ocradmin.ocrpresets.views.new'),
	(r'^search$', 'ocradmin.ocrpresets.views.search'),
	(r'^show/(?P<pk>\d+)/$', 'ocradmin.ocrpresets.views.show'),
	(r'^update/(?P<pk>\d+)/$', 'ocradmin.ocrpresets.views.update'),
   (r'^/?$', 'ocradmin.ocrpresets.views.index'),
)
