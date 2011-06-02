from django.conf.urls.defaults import *

urlpatterns = patterns('',
    (r'^query/?$', 'ocradmin.plugins.views.query'),
    (r'^run/?$', 'ocradmin.plugins.views.runscript'),
    (r'^results/(?P<task_ids>[^\/]+)/?$', 'ocradmin.plugins.views.results'),
    (r'^upload/?$', 'ocradmin.plugins.views.upload_file'),
)
