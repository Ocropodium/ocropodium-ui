from django.conf.urls.defaults import *

from ocradmin.batch import views
from django.contrib.auth.decorators import login_required

urlpatterns = patterns('',
    (r'^abort/(?P<batch_pk>\d+)/?$', login_required(views.abort_batch)),
	(r'^create/?$', login_required(views.create)),
	(r'^create_document_batch/?$', login_required(views.create_document_batch)),
	(r'^delete/(?P<pk>\d+)/?$', login_required(views.batchdelete)),
	(r'^export_options/(?P<batch_pk>\d+)/?$', login_required(views.export_options)),
	(r'^export/(?P<batch_pk>\d+)/?$', login_required(views.export)),
	(r'^latest/?$', login_required(views.latest)),
	(r'^list/?$', login_required(views.batchlist)),
	(r'^new/?$', login_required(views.new)),
	(r'^new_document_batch/?$', login_required(views.new_document_batch)),
    (r'^results/(?P<batch_pk>\d+)/?$', login_required(views.results)),
    (r'^results/(?P<batch_pk>\d+)/(?P<page_index>\d+)/?$', login_required(views.page_results)),
    (r'^retry/(?P<batch_pk>\d+)/?$', login_required(views.retry)),
    (r'^retry_errored/(?P<batch_pk>\d+)/?$', login_required(views.retry_errored)),
    (r'^show/(?P<batch_pk>\d+)/?$', login_required(views.show)),
	(r'^spellcheck/?$', login_required(views.spellcheck)),
    (r'^transcript/(?P<batch_pk>\d+)/?$', login_required(views.transcript)),
    (r'^test/?$', login_required(views.test)),
	(r'^upload_files/?$', login_required(views.upload_files)),
)
