"""
Interface to interacting with OCR presets.
"""

import os
import glob
import json

from django import forms
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render

from ocradmin.core import generic_views as gv
from ocradmin.core.decorators import saves_files
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.plugins import graph, cache
from ocradmin.plugins import utils as pluginutils
from ocradmin.presets.models import Preset, Profile

from nodetree import script, node, registry
from nodetree import utils as nodeutils

from ocradmin.plugins import nodes


class PresetForm(forms.ModelForm):
    """
        Base preset form
    """
    def __init__(self, *args, **kwargs):
        super(PresetForm, self).__init__(*args, **kwargs)
        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40        

    class Meta:
        model = Preset
        fields = ["name", "tags", "description", "public", "user", "data"]
        exclude = ["created_on", "updated_on"]
        widgets = dict(
                user=forms.HiddenInput()
        )


class ProfileForm(forms.ModelForm):
    """
        Base profile form
    """
    def __init__(self, *args, **kwargs):
        super(ProfileForm, self).__init__(*args, **kwargs)
        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40        

    class Meta:
        model = Profile
        fields = ["name", "tags", "description", "data"]
        exclude = ["created_on", "updated_on"]


presetlist = gv.GenericListView.as_view(
        model=Preset,
        page_name="OCR Presets",
        fields=["name", "description", "user", "created_on"],)


presetcreate = gv.GenericCreateView.as_view(
        model=Preset,
        form_class=PresetForm,
        page_name="New OCR Preset",)


presetdetail = gv.GenericDetailView.as_view(
        model=Preset,
        page_name="OCR Preset",
        fields=["name", "description", "user", "public", "tags", "created_on",
            "updated_on",])


presetedit = gv.GenericEditView.as_view(
        model=Preset,
        form_class=PresetForm,
        page_name="Edit OCR Preset",)


presetdelete = gv.GenericDeleteView.as_view(
        model=Preset,
        page_name="Delete OCR Preset",
        success_url="/presets/list/",)


profilelist = gv.GenericListView.as_view(
        model=Profile,
        page_name="OCR Profiles",
        fields=["name", "description", "user", "created_on"],)


profilecreate = gv.GenericCreateView.as_view(
        model=Profile,
        form_class=ProfileForm,
        page_name="New OCR Profile",)


profiledetail = gv.GenericDetailView.as_view(
        model=Profile,
        page_name="OCR Profile",
        fields=["name", "description", "user", "public", "tags", "created_on",
            "updated_on",])


profileedit = gv.GenericEditView.as_view(
        model=Profile,
        form_class=ProfileForm,
        page_name="Edit OCR Profile",)


profiledelete = gv.GenericDeleteView.as_view(
        model=Profile,
        page_name="Delete OCR Profile",
        success_url="/profiles/list/",)


def createjson(request):
    """Create a preset and return JSON data"""
    data = request.POST.copy()
    data.update(dict(user=request.user.pk))
    form = PresetForm(data)
    if not form.is_valid():
        return HttpResponse(json.dumps(form.errors),
                mimetype="application/json")
    form.save()
    return HttpResponse(json.dumps(form.instance.slug),
            status=201, mimetype="application/json")


def data(request, slug):
    """Return the data for a given preset in JSON format"""
    preset = get_object_or_404(Preset, slug=slug)
    return HttpResponse(preset.data, mimetype="application/json")


def update_data(request, slug):
    """Update script data for a given script."""
    preset = get_object_or_404(Preset, slug=slug)
    scriptdata = request.POST.get("data", "")
    # TODO: Validate script data
    preset.data = scriptdata
    preset.save()
    return HttpResponse(preset.data, mimetype="application/json")


def download(request, slug):
    """Return the data for a preset as an attachment"""
    preset = get_object_or_404(Preset, slug=slug)
    response = HttpResponse(preset.data, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=%s.json" % slug
    return response


def fetch(request):
    """Hacky method of forcing downloading of an in-progress script via JS"""
    slug = request.POST.get("name", "untitled")
    script = request.POST.get("script")
    response = HttpResponse(script, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=%s.json" % slug
    return response


@saves_files
def builder(request):
    """
    Show the preset builder.
    """
    return render(request, "presets/builder.html", {})


@saves_files
def builder_task_edit(request, task_pk):
    """
    Show the preset builder for a specific task.
    """
    from ocradmin.ocrtasks.models import OcrTask
    task = get_object_or_404(OcrTask, pk=task_pk)
    path, script, outdir = task.args
    ref = request.GET.get("ref", "/batch/show/%d/" % task.batch.pk)
    return render(request, "presets/builder.html", dict(task=task, ref=ref))


def query_nodes(request):
    """
    Query plugin info.  This returns a list
    of available OCR engines and an URL that
    can be queries when one of them is selected.
    """
    stages = request.GET.getlist("stage")
    nodes = registry.nodes.get_by_attr("stage", *stages)
    return HttpResponse(
            json.dumps(nodes, cls=nodeutils.NodeEncoder),
            mimetype="application/json")


@saves_files
def run_preset(request):
    """
    Execute a script (sent as JSON).
    """
    evalnode = request.POST.get("node", "")
    jsondata = request.POST.get("script")
    nodes = json.loads(jsondata)
    tree = script.Script(nodes)
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
            request.output_path, _cache_name(request)),
            untracked=True, asyncronous=True, queue="interactive")
    out = dict(
        node=evalnode,
        task_id=async.task_id,
        status=async.status,
        results=async.result
    )
    response = HttpResponse(mimetype="application/json")
    json.dump(out, response, ensure_ascii=False)
    return response


def results(request, task_ids):
    """
    Fetch the results of several Celery task ids.
    """
    out = []
    for task_id in task_ids.split(","):
        async = OcrTask.get_celery_result(task_id)
        out.append(dict(
            result=_flatten_result(async.result),
            task_id=task_id,
            status=async.status,
        ))
    response = HttpResponse(mimetype="application/json")
    json.dump(out, response, ensure_ascii=False)
    return response


def abort(request, task_ids):
    """
    Kill a running task.
    """
    out = []
    for task_id in task_ids.split(","):
        OcrTask.revoke_celery_task(task_id, kill=True)
        out.append(dict(
            task_id=task_id,
        ))
    response = HttpResponse(mimetype="application/json")
    json.dump(out, response, ensure_ascii=False)
    return response


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


def _flatten_result(result):
    """
    Ensure we can serialize a celery result.
    """
    if issubclass(type(result), Exception):
        return result.message
    else:
        return result


def _cache_name(request):
    """
    Name for a preset cache.
    """
    return "cache_%s" % request.user.username


def clear_cache(request):
    """
    Clear a preset data cache.
    """
    cacheclass = pluginutils.get_dzi_cacher(settings)
    cacher = cacheclass(
            path=os.path.join(settings.MEDIA_ROOT, settings.TEMP_PATH), 
            key=_cache_name(request))
    cacher.clear()
    return HttpResponse(json.dumps({"ok": True}), 
            mimetype="application/json")


def clear_node_cache(request):    
    """
    Clear the preset cache for a single node.
    """
    evalnode = request.POST.get("node")
    jsondata = request.POST.get("script")
    nodes = json.loads(jsondata)
    tree = script.Script(nodes)
    node = tree.get_node(evalnode)
    cacheclass = pluginutils.get_dzi_cacher(settings)
    cacher = cacheclass(
            path=os.path.join(settings.MEDIA_ROOT, settings.TEMP_PATH), 
            key=_cache_name(request))
    cacher.clear_cache(node)
    return HttpResponse(json.dumps({"ok": True}), 
            mimetype="application/json")


