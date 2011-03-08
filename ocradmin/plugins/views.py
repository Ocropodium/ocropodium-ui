"""
RESTful interface to interacting with OCR plugins.
"""
import re
import copy
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response
from django.utils import simplejson
from django.core.urlresolvers import reverse

import pprint

from ocradmin.core.tools.manager import PluginManager 
from ocradmin.plugins import parameters


def index(request):
    """
    List available plugins.
    """
    return HttpResponse(simplejson.dumps(PluginManager.get_provider()),
            mimetype="application/json")


def info(request, name):
    """
    Generic info about a plugin.
    """
    return HttpResponse(simplejson.dumps(PluginManager.get_info(name)),
            mimetype="application/json")


def run_get_method(request, name, method):
    """
    Run a method named get_<SOMETHING>.
    """
    try:
        func = getattr(PluginManager, "get_%s" % method)
    except AttributeError:
        raise Http404("No method 'get_%s' enabled via plugin manager." % method)
    return HttpResponse(simplejson.dumps(func(name, **request.GET)),
            mimetype="application/json")


def query(request, args=None):
    """
    Query plugin info.  This returns a list
    of available OCR engines and an URL that
    can be queries when one of them is selected.
    """
    parts = []
    data = None
    if args:
        parts = re.sub("(^/|/$)", "", args).split("/")
    if not parts:        
        data = dict(
            choices=PluginManager.get_plugins(),
            type="list",
            name="engine",
            description="Available OCR plugins",
        )
    else:
        data = PluginManager.get_parameters(parts[0], *parts[1:])
    return HttpResponse(simplejson.dumps(data),
            mimetype="application/json")
    

def parse(request):
    """
    Parse the options.
    """
    pp = pprint.PrettyPrinter(indent=2)
    if request.method == "POST":
        c = parameters.OcrParameters.from_post_data(request.POST)
        pp.pprint(c)
    return HttpResponseRedirect("/ocr/testparams/")        



