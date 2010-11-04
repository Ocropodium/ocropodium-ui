from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^new/?$', 'ocradmin.training.views.new'),
	(r'^compare/?$', 'ocradmin.training.views.compare'),
	(r'^comparison/?$', 'ocradmin.training.views.comparison_from_batch'),
	(r'^comparison/(?P<comparison_pk>\d+)/?$', 'ocradmin.training.views.comparison'),
	(r'^comparisons/?$', 'ocradmin.training.views.comparisons'),
	(r'^score_models/?$', 'ocradmin.training.views.score_models'),
	(r'^create/?$', 'ocradmin.training.views.create'),
	(r'^show_paramscore/(?P<paramscore_pk>\d+)/$', 'ocradmin.training.views.show_paramscore'),
)