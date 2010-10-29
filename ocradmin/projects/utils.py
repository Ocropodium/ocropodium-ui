# Miscellaneos functions relating the projects app
from django.http import HttpResponseRedirect
from django.utils.http import urlquote

def project_required(func):
    """
    Decorator function for other actions that
    require a project to be open in the session.
    """
    def wrapper(request, *args, **kwargs):
        path = urlquote(request.get_full_path())
        if not request.session.get("project"):
            return HttpResponseRedirect("/projects/list/?next=%s" % path)
        return func(request, *args, **kwargs)
    return wrapper




