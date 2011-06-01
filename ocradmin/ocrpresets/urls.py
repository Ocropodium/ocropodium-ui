
from django.conf.urls.defaults import *
from ocradmin.ocrpresets.views import PresetListView, PresetEditView

urlpatterns = patterns('',
    (r'^list/?$', PresetListView.as_view(template_name="generic_list.html")),
    (r'^edit/(?P<object_id>\d+)/?$', PresetEditView.as_view()),


)
