# Miscellaneos functions relating the projects app
import os
from datetime import datetime
from django.http import HttpResponseRedirect
from django.utils.http import urlquote
from django.conf import settings


def project_required(func):
    """
    Decorator function for other actions that
    require a project to be open in the session.
    """
    def wrapper(request, *args, **kwargs):
        path = urlquote(request.get_full_path())
        if not request.session.get("project"):
            return HttpResponseRedirect("/projects/list/?next=%s" % path)
        request.project = request.session.get("project")
        return func(request, *args, **kwargs)
    return wrapper


def saves_files(func):
    """
    Decorator function for other actions that
    require a project to be open in the session.
    """
    def wrapper(request, *args, **kwargs):
        temp = request.path.startswith(("/nodelib/"))
        project = request.session.get("project")
        output_path = None
        if project is None:
            temp = True
        if temp:
            output_path = os.path.join(
                settings.MEDIA_ROOT,
                settings.TEMP_PATH,
                request.user.username,
                datetime.now().strftime("%Y%m%d%H%M%S")
            )
        else:
            output_path = os.path.join(
                settings.MEDIA_ROOT,
                settings.USER_FILES_PATH,
                project.slug
            )
        request.__class__.output_path = output_path
        return func(request, *args, **kwargs)
    return wrapper



