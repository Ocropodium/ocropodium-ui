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
    (r'^batch/?$', login_required(views.quick_batch)),
    (r'^show/(?P<pid>[^/]+)/?$', login_required(views.detail)),
    (r'^edit/?$', login_required(views.editor)),
    (r'^edit/(?P<pid>[^/]+)/?$', login_required(views.editor)),
    (r'^transcript/(?P<pid>[^/]+)/?$', login_required(views.transcript)),
    (r'^binary/(?P<pid>[^/]+)/?$', login_required(views.binary)),
    (r'^status/(?P<pid>[^/]+)/?$', login_required(views.status)),
    (r'^show_small/(?P<pid>[^/]+)/?$', login_required(views.show_small)),
    (r'^delete/(?P<pid>[^/]+)/?$', login_required(views.delete)),
    (r'^delete_multiple/?$', login_required(views.delete_multiple)),
	(r'^spellcheck/?$', login_required(views.spellcheck)),
)
