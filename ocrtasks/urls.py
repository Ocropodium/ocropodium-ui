from django.conf.urls.defaults import *

urlpatterns = patterns('',
   (r'^/?$', 'ocradmin.ocrtasks.views.index'),
	(r'^list/?$', 'ocradmin.ocrtasks.views.list'),
	(r'^list2/?$', 'ocradmin.ocrtasks.views.list2'),
	(r'^update/?$', 'ocradmin.ocrtasks.views.update'),
    (r'^revoke/(?P<pk>[^\/]+)/?$', 'ocradmin.ocrtasks.views.revoke'),
    (r'^delete/(?P<pk>[^\/]+)?/?$', 'ocradmin.ocrtasks.views.delete'),
	(r'^show/(?P<pk>\d+)/$', 'ocradmin.ocrtasks.views.show'),
)
