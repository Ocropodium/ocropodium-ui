from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^new/?$', 'ocradmin.training.views.new'),
	(r'^create/?$', 'ocradmin.training.views.create'),
	(r'^save_task/(?P<pk>\d+)/$', 'ocradmin.training.views.save_task'),
)
