from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^ls/?$', 'ocradmin.filebrowser.views.ls'),
	(r'^explore/?$', 'ocradmin.filebrowser.views.explore'),
)
