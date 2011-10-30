"""
URLConf for OCR profiles.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.presets import profileviews as views


urlpatterns = patterns('',
    (r'^create/?$', login_required(views.profilecreate)),
    (r'^delete/(?P<slug>[-\w]+)/?$', login_required(views.profiledelete)),
    (r'^edit/(?P<slug>[-\w]+)/?$', login_required(views.profileedit)),
    (r'^list/?$', views.profilelist),
    (r'^show/(?P<slug>[-\w]+)/?$', views.profiledetail),
    (r'^(?P<slug>[-\w]+)/?$', views.profiledetail),
)
