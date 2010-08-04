from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.batch.views.index'),
	(r'^batch/?$', 'ocradmin.batch.views.batch'),
	(r'^latest/?$', 'ocradmin.batch.views.latest'),
	(r'^new/?$', 'ocradmin.batch.views.new'),
    (r'^results/(?P<pk>\d+)/?$', 'ocradmin.batch.views.results'),
    (r'^retry_batch/(?P<pk>\d+)/?$', 'ocradmin.batch.views.retry_batch'),
    (r'^retry_task/(?P<pk>\d+)/?$', 'ocradmin.batch.views.retry_task'),
    (r'^show/(?P<pk>\d+)/?$', 'ocradmin.batch.views.show'),
)
