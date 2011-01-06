from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocr.views.index'),
	(r'^binarize/?$', 'ocradmin.ocr.views.binarize'),
	(r'^components/?$', 'ocradmin.ocr.views.components'),
	(r'^convert/?$', 'ocradmin.ocr.views.convert'),
	(r'^segment/?$', 'ocradmin.ocr.views.segment'),
    (r'^results/(?P<task_id>[^\/]+)/?$', 'ocradmin.ocr.views.results'),
    (r'^results/?$', 'ocradmin.ocr.views.multiple_results'),
	(r'^test/(?P<ids>\d+(,\d+)*)/?$', 'ocradmin.ocr.views.test'),
)
