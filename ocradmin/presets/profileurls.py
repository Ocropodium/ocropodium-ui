"""
URLConf for OCR profiles.
"""
from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.presets import profileviews


urlpatterns = patterns('',
    (r'^create/?$', login_required(profileviews.profilecreate)),
    (r'^delete/(?P<slug>[-\w]+)/?$', login_required(profileviews.profiledelete)),
    (r'^edit/(?P<slug>[-\w]+)/?$', login_required(profileviews.profileedit)),
    (r'^list/?$', profileviews.profilelist),
    (r'^show/(?P<slug>[-\w]+)/?$', profileviews.profiledetail),
    (r'^(?P<slug>[-\w]+)/?$', profileviews.profiledetail),
)
