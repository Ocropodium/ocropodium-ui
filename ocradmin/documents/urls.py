"""
URLConf for OCR documents.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.documents import views


urlpatterns = patterns('',
	(r'^/?$', login_required(views.doclist)),
    (r'^list/?$', login_required(views.doclist)),
    (r'^create/?$', login_required(views.create)),
    (r'^create_ajax/?$', login_required(views.create_ajax)),
    (r'^show/(?P<pid>\d+)/?$', login_required(views.detail)),
    (r'^show_small/(?P<pid>[^/]+)/?$', login_required(views.show_small)),
    (r'^edit/(?P<pid>\d+)/?$', login_required(views.edit)),
    (r'^delete/(?P<pid>\d+)/?$', login_required(views.delete)),
)
