from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^new/?$', 'ocradmin.training.views.new'),
	(r'^compare/?$', 'ocradmin.training.views.compare'),
	(r'^comparison/?$', 'ocradmin.training.views.comparison_from_batch'),
	(r'^comparison/(?P<pk>\d+)/?$', 'ocradmin.training.views.comparison'),
	(r'^score_models/?$', 'ocradmin.training.views.score_models'),
	(r'^list/?$', 'ocradmin.training.views.list'),
	(r'^create/?$', 'ocradmin.training.views.create'),
	(r'^save_task/(?P<pk>\d+)/$', 'ocradmin.training.views.save_task'),
)
