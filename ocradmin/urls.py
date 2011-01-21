from django.conf.urls.defaults import *
from django.conf import settings

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    # Static media
    (r'^static/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.STATIC_ROOT}),
    (r'^media/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.MEDIA_ROOT}),
    
    (r'^/?$', include('ocradmin.ocr.urls')),
    (r'^ocr/?', include('ocradmin.ocr.urls')),
    (r'^accounts/?', include('ocradmin.accounts.urls')),
    (r'^filebrowser/?', include('ocradmin.filebrowser.urls')),
    (r'^batch/?', include('ocradmin.batch.urls')),
    (r'^ocrtasks/?', include('ocradmin.ocrtasks.urls')),
    (r'^ocrmodels/?', include('ocradmin.ocrmodels.urls')),
    (r'^ocrpresets/?', include('ocradmin.ocrpresets.urls')),
    (r'^projects/?', include('ocradmin.projects.urls')),
    (r'^reference_pages/?', include('ocradmin.reference_pages.urls')),
    (r'^training/?', include('ocradmin.training.urls')),

    # Uncomment the admin/doc line below and add 'django.contrib.admindocs' 
    # to INSTALLED_APPS to enable admin documentation:
     #(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
     (r'^admin/', include(admin.site.urls)),
)
