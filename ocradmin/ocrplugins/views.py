"""
RESTful interface to interacting with OCR plugins.
"""
import re
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response
from django.utils import simplejson
from django.core.urlresolvers import reverse

import pprint

from ocradmin.ocr.tools.manager import PluginManager 


def list(request):
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
        c = _parse_options(request.POST)
        pp.pprint(c)
    return HttpResponseRedirect("/ocr/testparams/")        



def _parse_options(postdict):
    """
    Parse options into a dictionary.
    """
    # parse the postdict into a conventient, sorted
    # array of tuples:
    # [(name, value), (name, value)]
    post = []
    for k, v in postdict.iteritems():
        if not k.startswith("$options"):
            continue
        post.append((k, v))
    post.sort()
    paramstruct = _initialise_param_structure(post)
    params = _populate_param_structure(
            post, paramstruct)
    return _cleanup_empty_param_lists(params)


def _initialise_param_structure(post):
    """
    Build the initial parameter structure.
    """
    cleaned = dict(params=[])
    for name, value in post:
        parts = name.split(":")
        parts.pop(0)
        curr = cleaned["params"]
        for part in parts:
            index = None
            imatch = re.search("(?P<base>.+)\[(?P<index>\d+)\]$", part)
            if imatch:
                part, index = imatch.groups()
            found = False
            for param in curr:
                if param["name"] == part:
                    found = True
                    curr = param["params"]
                    break
            if found:
                continue
            params = []
            d = dict(
                name=part,
                params=params,
            )
            if index is not None:
                while len(curr) < int(index) + 1:
                    curr.append(None)
                print "Setting ele index: %s -> %s" % (d, index)
                curr[int(index)] = d
            else:
                curr.append(d)                    
            curr = params
    print "STRUCTURE:"
    pp = pprint.PrettyPrinter(indent=2)
    pp.pprint(cleaned)
    return cleaned


def _populate_param_structure(post, params):
    """
    Populate the parameter data structure
    with values.
    """
    for name, value in post:
        parts = name.split(":")
        curr = params["params"]
        key = parts.pop()
        for part in parts:
            index = None
            imatch = re.search("(?P<base>.+)\[(?P<index>\d+)\]$", part)
            if imatch:
                part, index = imatch.groups()
            for param in curr:
                if param["name"] == part:
                    curr = param["params"]
                    break
            for param in curr:
                if param["name"] == key:
                    param["value"] = value
    return params

def _cleanup_empty_param_lists(params):
    """
    Recursively clean out empty param slots.
    """
    def cleanup_param(param):
        if len(param["params"]) == 0:
            del param["params"]
        else:
            for p in param.get("params"):
                cleanup_param(p)
    for p in params["params"]:
        cleanup_param(p)
    return params["params"]        



