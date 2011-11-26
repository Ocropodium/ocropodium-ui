from django.conf.urls.defaults import *
from django.contrib.auth.decorators import login_required
from ocradmin.core import views

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.core.views.index'),
    (r'^abort/(?P<task_id>[^\/]+)/?$', login_required(views.abort)),
    (r'^task_transcript/(?P<task_pk>\d+)/?$', login_required(views.task_transcript)),
    (r'^save/(?P<task_pk>\d+)/?$', login_required(views.save_transcript)),
    (r'^submit_viewer_binarization/(?P<task_pk>\d+)/?$', 
            login_required(views.submit_viewer_binarization)),
    (r'^transcript/(?P<task_pk>\d+)/?$', login_required(views.transcript)),
    (r'^task_config/(?P<task_pk>\d+)/?$', login_required(views.task_config)),
    (r'^result/(?P<task_id>[^\/]+)/?$', login_required(views.result)),
    (r'^results/(?P<task_ids>[^\/]+)/?$', login_required(views.results)),
    (r'^update_task/(?P<task_pk>\d+)/?$', login_required(views.update_ocr_task)),
	(r'^test/?$', views.test),
	(r'^testparams/?$', views.testparams),
)
