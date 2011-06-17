"""
RESTful interface to interacting with OCR plugins.
"""

import os

from django.http import HttpResponse
from django.utils import simplejson as json

from ocradmin.core.decorators import saves_files
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.plugins import graph, cache

from nodetree import script, node
from nodetree.manager import ModuleManager

MANAGER = ModuleManager()
MANAGER.register_module("ocradmin.plugins.ocropus_nodes")
MANAGER.register_module("ocradmin.plugins.tesseract_nodes")
MANAGER.register_module("ocradmin.plugins.cuneiform_nodes")
MANAGER.register_module("ocradmin.plugins.abbyy_nodes")
MANAGER.register_module("ocradmin.plugins.numpy_nodes")
MANAGER.register_module("ocradmin.plugins.pil_nodes")

def query(request):
    """
    Query plugin info.  This returns a list
    of available OCR engines and an URL that
    can be queries when one of them is selected.
    """
    stages = request.GET.getlist("stage")
    return HttpResponse(
            MANAGER.get_json(*stages), mimetype="application/json")


@saves_files
def runscript(request):
    """
    Execute a script (sent as JSON).
    """
    evalnode = request.POST.get("node", "")
    jsondata = request.POST.get("script")
    nodes = json.loads(jsondata)
    tree = script.Script(nodes, manager=MANAGER)
    errors = tree.validate()
    if errors:
        return HttpResponse(json.dumps(dict(
            status="VALIDATION",
            errors=errors,
        )), mimetype="application/json")

    term = tree.get_node(evalnode)
    if term is None:
        terms = tree.get_terminals()
        if not terms:
            return HttpResponse(json.dumps(dict(
                status="NOSCRIPT",
            )), mimetype="application/json")
        term = terms[0]
    async = OcrTask.run_celery_task("run.script", (evalnode, nodes,
            request.output_path), taskkwargs={}, untracked=True,
            asyncronous=True, queue="interactive")
    out = dict(
        node=evalnode,
        task_id=async.task_id,
        status=async.status,
        results=async.result
    )
    return HttpResponse(json.dumps(out), mimetype="application/json")


def results(request, task_ids):
    """
    Fetch the results of several Celery task ids.
    """
    out = []
    for task_id in task_ids.split(","):
        async = OcrTask.get_celery_result(task_id)
        out.append(dict(
            result=async.result,
            task_id=task_id,
            status=async.status,
        ))
    return HttpResponse(json.dumps(out), mimetype="application/json")


@saves_files
def upload_file(request):
    """
    Upload a temp file.
    """
    fpath = os.path.join(request.output_path,
            request.GET.get("inlinefile"))
    if not os.path.exists(request.output_path):
        os.makedirs(request.output_path, 0777)
    tmpfile = file(fpath, "wb")
    tmpfile.write(request.raw_post_data)
    tmpfile.close()
    return HttpResponse(json.dumps(dict(
        file=os.path.relpath(fpath),
    )), mimetype="application/json")


def layout_graph(request):
    """
    Get GraphViz positions for nodes in a list.
    """
    jsonscript = request.POST.get("script")
    nodes = json.loads(jsonscript)
    return HttpResponse(
            json.dumps(graph.get_node_positions(nodes)),
                mimetype="application/json")

