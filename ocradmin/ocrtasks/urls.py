from django.conf.urls.defaults import *

from ocradmin.ocrtasks import views
from django.contrib.auth.decorators import login_required

urlpatterns = patterns('',
	(r'^list/?$', login_required(views.tasklist)),
	(r'^detail/(?P<pk>\d+)/$', login_required(views.taskdetail)),
    (r'^delete/(?P<pk>\d+)?/?$', login_required(views.taskdelete)),
	(r'^show/(?P<pk>\d+)/$', login_required(views.show)),
    (r'^abort/(?P<task_pk>\d+)/?$', login_required(views.abort)),
    (r'^retry/(?P<task_pk>\d+)/?$', login_required(views.retry)),
   (r'^/?$', login_required(views.tasklist)),
)
