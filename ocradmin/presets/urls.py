"""
URLConf for OCR presets.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.presets import views


urlpatterns = patterns('',
    (r'^list/?$', views.presetlist),
    (r'^create/?$', login_required(views.presetcreate)),
    (r'^createjson/?$', login_required(views.createjson)),
    (r'^show/(?P<slug>[-\w]+)/?$', views.presetdetail),
    (r'^edit/(?P<slug>[-\w]+)/?$', login_required(views.presetedit)),
    (r'^delete/(?P<slug>[-\w]+)/?$', login_required(views.presetdelete)),
    (r'^data/(?P<slug>[-\w]+)/?$', views.data),
    (r'^update_data/(?P<slug>[-\w]+)/?$', views.update_data),
    (r'^download/(?P<slug>[-\w]+)/?$', views.download),
    (r'^fetch/?$', views.fetch),
    (r'^query/?$', views.query_nodes),
    (r'^run/?$', views.run_preset),
    (r'^abort/(?P<task_ids>[^\/]+)/?$', login_required(views.abort)),
    (r'^results/(?P<task_ids>[^\/]+)/?$', login_required(views.results)),
    (r'^upload/?$', login_required(views.upload_file)),
    (r'^layout_graph/?$', views.layout_graph),
	(r'^builder/?$', login_required(views.builder)),
    (r'^(?P<slug>[-\w]+)/?$', views.presetdetail),
)
