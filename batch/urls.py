from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.batch.views.index'),
	(r'^batch/?$', 'ocradmin.batch.views.batch'),
    (r'^results/(?P<pk>\d+)/?$', 'ocradmin.batch.views.results'),
)
