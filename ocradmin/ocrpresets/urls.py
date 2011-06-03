"""
URLConf for OCR presets.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.ocrpresets import views


urlpatterns = patterns('',
    (r'^list/?$', views.presetlist),
    (r'^create/?$', login_required(views.presetcreate)),
    (r'^show/(?P<slug>[-\w]+)/?$', views.presetdetail),
    (r'^edit/(?P<slug>[-\w]+)/?$', login_required(views.presetedit)),
    (r'^delete/(?P<slug>[-\w]+)/?$', login_required(views.presetdelete)),
    (r'^(?P<slug>[-\w]+)/data/?$', views.data),
    (r'^(?P<slug>[-\w]+)/?$', views.presetdetail),
)
