from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocrtasks.views.index'),
    (r'^abort/(?P<task_pk>\d+)/?$', 'ocradmin.ocrtasks.views.abort'),
	(r'^list/?$', 'ocradmin.ocrtasks.views.list_tasks'),
	(r'^list2/?$', 'ocradmin.ocrtasks.views.list2'),
	(r'^update/?$', 'ocradmin.ocrtasks.views.update'),
    (r'^revoke/(?P<task_pk>\d+)/?$', 'ocradmin.ocrtasks.views.revoke'),
    (r'^delete/(?P<task_pk>\d+)?/?$', 'ocradmin.ocrtasks.views.delete'),
    (r'^retry/(?P<task_pk>\d+)/?$', 'ocradmin.ocrtasks.views.retry'),
	(r'^show/(?P<task_pk>\d+)/$', 'ocradmin.ocrtasks.views.show'),
)
