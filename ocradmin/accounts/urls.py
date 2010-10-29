from django.conf.urls.defaults import *

urlpatterns = patterns('',
	(r'^$', 'ocradmin.accounts.views.login'),
	(r'^login', 'ocradmin.accounts.views.login'),
	(r'^logout', 'ocradmin.accounts.views.logout'),
	(r'^unauthorised', 'ocradmin.accounts.views.unauthorised'),
)
