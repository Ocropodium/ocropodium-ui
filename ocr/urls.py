from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocr.views.index'),
	(r'^binarize/?$', 'ocradmin.ocr.views.binarize'),
	(r'^components/?$', 'ocradmin.ocr.views.components'),
	(r'^convert/?$', 'ocradmin.ocr.views.convert'),
	(r'^segment/?$', 'ocradmin.ocr.views.segment'),
    (r'^results/(?P<job_name>[^\/]+)/?$', 'ocradmin.ocr.views.results'),
	(r'^test/(?P<ids>\d+(,\d+)*)/?$', 'ocradmin.ocr.views.test'),
    (r'^zipped_results/?$', 'ocradmin.ocr.views.zipped_results'),
)
