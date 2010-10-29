from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^scale/?$', 'ocradmin.imageops.views.scale'),
)
