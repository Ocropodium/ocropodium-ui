from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^/?$', 'ocradmin.reference_pages.views.index'),
	(r'^list/?$', 'ocradmin.reference_pages.views.list_reference_pages'),
	(r'^show/(?P<page_pk>\d+)/?$', 'ocradmin.reference_pages.views.show'),
	(r'^delete/(?P<page_pk>\d+)/?$', 'ocradmin.reference_pages.views.delete'),
	(r'^create_from_task/(?P<task_pk>\d+)/?$', 'ocradmin.reference_pages.views.create_from_task'),
)
