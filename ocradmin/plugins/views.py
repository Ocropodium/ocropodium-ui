"""
RESTful interface to interacting with OCR plugins.
"""
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response

from ocradmin.plugins.manager import ModuleManager 


def query(request):
    """
    Query plugin info.  This returns a list
    of available OCR engines and an URL that
    can be queries when one of them is selected.
    """
    stages=request.GET.getlist("stage")
    return HttpResponse(
            ModuleManager.get_json(*stages), mimetype="application/json")
