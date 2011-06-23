from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.core.views.index'),
    (r'^task_transcript/(?P<task_pk>\d+)/?$', 'ocradmin.core.views.task_transcript'),
    (r'^save/(?P<task_pk>\d+)/?$', 'ocradmin.core.views.save_transcript'),
    (r'^submit_viewer_binarization/(?P<task_pk>\d+)/?$',
        'ocradmin.core.views.submit_viewer_binarization'),
    (r'^transcript/(?P<task_pk>\d+)/?$', 'ocradmin.core.views.transcript'),
    (r'^viewer_binarization_results/(?P<task_id>[^\/]+)/?$',
        'ocradmin.core.views.viewer_binarization_results'),
    (r'^update_task/(?P<task_pk>\d+)/?$', 'ocradmin.core.views.update_ocr_task'),
	(r'^test/?$', 'ocradmin.core.views.test'),
	(r'^testparams/?$', 'ocradmin.core.views.testparams'),
)
