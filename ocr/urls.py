from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocr.views.convert'),
	(r'^convert$', 'ocradmin.ocr.views.convert'),
    (r'^results/(?P<job_name>[^\/]+)/?$', 'ocradmin.ocr.views.results'),
)
