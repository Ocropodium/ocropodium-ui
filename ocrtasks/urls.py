from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocrtasks.views.index'),
	(r'^list/?$', 'ocradmin.ocrtasks.views.list'),
	(r'^update/?$', 'ocradmin.ocrtasks.views.update'),
    (r'^revoke/(?P<task_id>[^\/]+)/?$', 'ocradmin.ocr.views.revoke'),
	(r'^show/(?P<pk>\d+)/$', 'ocradmin.ocrtasks.views.show'),
)
