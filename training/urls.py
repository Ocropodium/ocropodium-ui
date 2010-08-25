from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^new/?$', 'ocradmin.ocrtraining.views.new'),
	(r'^create/?$', 'ocradmin.ocrtraining.views.create'),
	(r'^save_task/(?P<pk>\d+)/$', 'ocradmin.ocrtraining.views.save_task'),
)
