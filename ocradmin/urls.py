from django.conf.urls.defaults import *
from django.conf import settings

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
from django.contrib.auth.views import login, logout
admin.autodiscover()

import djcelery

urlpatterns = patterns('',
    # Static media
    (r'^static/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.STATIC_ROOT}),
    (r'^media/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.MEDIA_ROOT}),
    
    (r'^accounts/login', login),
    (r'^accounts/logout', logout, {"next_page": "/ocr/"}),
    (r'^/?$', include('ocradmin.core.urls')),
    (r'^ocr/?', include('ocradmin.core.urls')),
    (r'^filebrowser/?', include('ocradmin.filebrowser.urls')),
    (r'^documents/?', include('ocradmin.documents.urls')),
    (r'^batch/?', include('ocradmin.batch.urls')),
    (r'^ocrtasks/?', include('ocradmin.ocrtasks.urls')),
    (r'^ocrmodels/?', include('ocradmin.ocrmodels.urls')),
    (r'^presets/?', include('ocradmin.presets.urls')),
    (r'^profiles/?', include('ocradmin.presets.profileurls')),
    (r'^projects/?', include('ocradmin.projects.urls')),
    (r'^celery/?', include('djcelery.urls')),

    # Uncomment the admin/doc line below and add 'django.contrib.admindocs' 
    # to INSTALLED_APPS to enable admin documentation:
     #(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
     (r'^admin/', include(admin.site.urls)),
)
