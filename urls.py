from django.conf.urls.defaults import *
from django.conf import settings

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    # Static media
    (r'^static/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.STATIC_ROOT}),
    
    (r'^/?$', include('ocradmin.ocr.urls')),
    (r'^ocr/', include('ocradmin.ocr.urls')),
    (r'^accounts/?', include('ocradmin.accounts.urls')),
    (r'^ocrtasks/', include('ocradmin.ocrtasks.urls')),
    (r'^ocrmodels/', include('ocradmin.ocrmodels.urls')),

    # Uncomment the admin/doc line below and add 'django.contrib.admindocs' 
    # to INSTALLED_APPS to enable admin documentation:
     #(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
     (r'^admin/', include(admin.site.urls)),
)
