# App for browsing the server.

import os
from stat import *
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response
from django.template import RequestContext
from django.utils import simplejson
from django.utils.simplejson.encoder import JSONEncoder


class ExtJsonEncoder(JSONEncoder):
    def default(self, c):
        # Handles generators and iterators
        if hasattr(c, '__iter__'):
            return [i for i in c]

        # Handles closures and functors
        if hasattr(c, '__call__'):
            return c()

        return JSONEncoder.default(self, c)


def entry_info(path):
    """
    Return info on a directory entry.
    """
    for entry in os.listdir(path):
        type = "unknown"
        st = os.stat(os.path.join(path, entry))
        mode = st[ST_MODE]
        if S_ISDIR(mode):
            type = "dir"
        elif S_ISLNK(mode):
            type = "link"
        elif S_ISREG(mode):
            type = "file"
        yield (
            entry,
            type,
            st.st_size,
            st.st_atime,
            st.st_mtime,
            st.st_ctime
        )
            

@login_required
def ls(request):
    """
    List a directory on the server.
    """

    dir = request.GET.get("dir", "")
    root = os.path.join(
            os.path.abspath(settings.MEDIA_ROOT), "files", request.user.username)
    fulldir = os.path.join(root, dir)
    response = HttpResponse(mimetype="application/json")
    simplejson.dump(entry_info(fulldir), response, cls=ExtJsonEncoder)
    return response



@login_required
def explore(request):
    """
    Browse the server file system.
    """


    return render_to_response("filebrowser/explore.html",
            {}, context_instance=RequestContext(request))
