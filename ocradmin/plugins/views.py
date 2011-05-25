"""
RESTful interface to interacting with OCR plugins.
"""
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response

from ocradmin.plugins.manager import ModuleManager 

import logging
logger = logging.getLogger(__name__)

import simplejson

def query(request):
    """
    Query plugin info.  This returns a list
    of available OCR engines and an URL that
    can be queries when one of them is selected.
    """
    stages=request.GET.getlist("stage")
    return HttpResponse(
            ModuleManager.get_json(*stages), mimetype="application/json")

def runscript(request):
    """
    Execute a script (sent as JSON).
    """
    node = request.POST.get("node", "")
    script = request.POST.get("script", simplejson.dumps({"arse":"spaz"}))
    data = simplejson.loads(script)

    import apply
    try:
        pl = apply.OcrPipeline(data)
        term = pl.get_node(node)
        val = term.eval()
        print "VALUE: ", val
        logger.debug("Val is: %s", val)
    except StandardError, err:
        raise


    return HttpResponse(simplejson.dumps(val), mimetype="application/json")
