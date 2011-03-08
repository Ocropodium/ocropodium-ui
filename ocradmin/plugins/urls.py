from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^/?$', 'ocradmin.plugins.views.index'),
    (r'^query/?$', 'ocradmin.plugins.views.query'),
    (r'^query/(?P<args>.+)/?$', 'ocradmin.plugins.views.query'),
    (r'^parse/?$', 'ocradmin.plugins.views.parse'),
	(r'^(?P<name>[^/]+)/?$', 'ocradmin.plugins.views.info'),
	(r'^(?P<name>\w+)/(?P<method>\w+)/?$', 'ocradmin.plugins.views.run_get_method'),
)
