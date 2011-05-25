from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^query/?$', 'ocradmin.plugins.views.query'),
    (r'^run/?$', 'ocradmin.plugins.views.runscript'),
)
