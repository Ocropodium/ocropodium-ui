from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^list/?$', 'ocradmin.reference_pages.views.list'),
	(r'^show/(?P<page_pk>\d+)/?$', 'ocradmin.reference_pages.views.show'),
	(r'^delete/(?P<page_pk>\d+)/?$', 'ocradmin.reference_pages.views.delete'),
	(r'^create_from_task/(?P<task_pk>\d+)/?$', 'ocradmin.reference_pages.views.create_from_task'),
)
