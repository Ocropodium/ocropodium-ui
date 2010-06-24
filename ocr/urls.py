from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocr.views.convert'),
	(r'^binarize$', 'ocradmin.ocr.views.binarize'),
	(r'^components/?$', 'ocradmin.ocr.views.components'),
	(r'^convert$', 'ocradmin.ocr.views.convert'),
    (r'^results/(?P<job_name>[^\/]+)/?$', 'ocradmin.ocr.views.results'),
)
