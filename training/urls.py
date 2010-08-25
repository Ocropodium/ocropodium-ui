from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^new/?$', 'ocradmin.training.views.new'),
	(r'^compare/?$', 'ocradmin.training.views.compare'),
	(r'^comparison/(?P<pk>\d+)/?$', 'ocradmin.training.views.comparison'),
	(r'^score_models/?$', 'ocradmin.training.views.score_models'),
	(r'^create/?$', 'ocradmin.training.views.create'),
	(r'^save_task/(?P<pk>\d+)/$', 'ocradmin.training.views.save_task'),
)
