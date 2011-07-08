from django.conf.urls.defaults import *

from ocradmin.batch import views

urlpatterns = patterns('',
    (r'^abort/(?P<batch_pk>\d+)/?$', views.abort_batch),
	(r'^create/?$', views.create),
	(r'^delete/(?P<batch_pk>\d+)/?$', views.delete),
	(r'^export_options/(?P<batch_pk>\d+)/?$', views.export_options),
	(r'^export/(?P<batch_pk>\d+)/?$', views.export),
	(r'^latest/?$', views.latest),
	(r'^list/?$', views.batchlist),
	(r'^new/?$', views.new),
    (r'^results/(?P<batch_pk>\d+)/?$', views.results),
    (r'^results/(?P<batch_pk>\d+)/(?P<page_index>\d+)/?$', views.page_results),
    (r'^retry/(?P<batch_pk>\d+)/?$', views.retry),
    (r'^retry_errored/(?P<batch_pk>\d+)/?$', views.retry_errored),
    (r'^show/(?P<batch_pk>\d+)/?$', views.show),
	(r'^spellcheck/?$', views.spellcheck),
    (r'^transcript/(?P<batch_pk>\d+)/?$', views.transcript),
    (r'^test/?$', views.test),
	(r'^upload_files/?$', views.upload_files),
)
