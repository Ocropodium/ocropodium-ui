from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocrmodels.views.index'),
	(r'^list/?$', 'ocradmin.ocrmodels.views.list'),
	(r'^new/?$', 'ocradmin.ocrmodels.views.new'),
	(r'^create/?$', 'ocradmin.ocrmodels.views.create'),
	(r'^show/(?P<pk>\d+)/$', 'ocradmin.ocrmodels.views.show'),
	(r'^edit/(?P<pk>\d+)/$', 'ocradmin.ocrmodels.views.edit'),
	(r'^update/(?P<pk>\d+)/$', 'ocradmin.ocrmodels.views.update'),
	(r'^delete/(?P<pk>\d+)/$', 'ocradmin.ocrmodels.views.delete'),
	(r'^search$', 'ocradmin.ocrmodels.views.search'),
)
