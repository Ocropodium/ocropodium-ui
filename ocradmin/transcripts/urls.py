"""
URLConf for OCR presets.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.transcripts import views


urlpatterns = patterns('',
    (r'^delete/(?P<pk>\d+)/?$', login_required(views.transcriptdelete)),
    (r'^edit/(?P<pk>\d+)/?$', login_required(views.transcriptedit)),
    (r'^list/?$', views.transcriptlist),
    (r'^show/(?P<pk>\d+)/?$', views.transcriptdetail),
    (r'^transcript/(?P<pk>\d+)/?$', login_required(views.transcript)),
)
