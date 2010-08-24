from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^save_task/(?P<pk>\d+)/$', 'ocradmin.ocrtraining.views.save_task'),
)
