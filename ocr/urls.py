from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocr.views.index'),
	(r'^batch/?$', 'ocradmin.ocr.views.batch'),
	(r'^binarize/?$', 'ocradmin.ocr.views.binarize'),
	(r'^components/?$', 'ocradmin.ocr.views.components'),
	(r'^convert/?$', 'ocradmin.ocr.views.convert'),
	(r'^segment/?$', 'ocradmin.ocr.views.segment'),
    (r'^batch_results/(?P<pk>\d+)/?$', 'ocradmin.ocr.views.batch_results_db'),
    (r'^batch_results/(?P<job_name>[^\/]+)/?$', 'ocradmin.ocr.views.batch_results'),
    (r'^results/(?P<job_name>[^\/]+)/?$', 'ocradmin.ocr.views.results'),
	(r'^test/?$', 'ocradmin.ocr.views.test'),
)
