from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^/?$', 'ocradmin.ocrplugins.views.list'),
    (r'^query/?$', 'ocradmin.ocrplugins.views.query'),
    (r'^query/(?P<args>.+)/?$', 'ocradmin.ocrplugins.views.query'),
    (r'^parse/?$', 'ocradmin.ocrplugins.views.parse'),
	(r'^(?P<name>[^/]+)/?$', 'ocradmin.ocrplugins.views.info'),
	(r'^(?P<name>\w+)/(?P<method>\w+)/?$', 'ocradmin.ocrplugins.views.run_get_method'),
)
