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
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_exempt


from ocradmin.core import generic_views as gv
from ocradmin.core.decorators import project_required, saves_files
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.nodelib import graph, cache
from ocradmin.nodelib import utils as pluginutils
from ocradmin.presets.models import Preset, Profile

from nodetree import script, node, registry
from nodetree import utils as nodeutils

from ocradmin.nodelib import nodes



class PresetForm(forms.ModelForm):
    """
        Base preset form
    """
    def __init__(self, *args, **kwargs):
        super(PresetForm, self).__init__(*args, **kwargs)
        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40

    def clean(self):
        cleaned_data = self.cleaned_data
        try:
            data = json.loads(self.cleaned_data["data"])
        except ValueError:
            msg = u"Preset data must be valid JSON"
            self._errors["data"] = self.error_class([msg])
            del cleaned_data["data"]            
        profile = self.cleaned_data["profile"]
        if profile is not None:
            errors = profile.validate_preset(data)
            if errors:
                self._errors["profile"] = self.error_class(errors)
                del cleaned_data["profile"]
        return cleaned_data

    class Meta:
        model = Preset
        fields = ["name", "tags", "description", "public", "profile", "user", "data"]
        exclude = ["created_on", "updated_on"]
        widgets = dict(
                user=forms.HiddenInput()
        )


presetlist = gv.GenericListView.as_view(
        model=Preset,
        page_name="OCR Presets",
        fields=["name", "description", "profile", "user", "created_on"],)


presetcreate = gv.GenericCreateView.as_view(
        model=Preset,
        form_class=PresetForm,
        page_name="New OCR Preset",)


presetdetail = gv.GenericDetailView.as_view(
        model=Preset,
        page_name="OCR Preset",
        fields=["name", "description", "user", "public", "profile", "tags", "created_on",
            "updated_on",])


presetedit = gv.GenericEditView.as_view(
        model=Preset,
        form_class=PresetForm,
        page_name="Edit OCR Preset",)


presetdelete = gv.GenericDeleteView.as_view(
        model=Preset,
        page_name="Delete OCR Preset",
        success_url="/presets/list/",)


def createjson(request):
    """Create a preset and return JSON data"""
    form = PresetForm(request.POST)
    if not form.is_valid():
        return HttpResponse(json.dumps(
            dict(description="Invalid preset", errors=form.errors)),
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
    if preset.profile:
        errors = {}
        try:
            data = json.loads(scriptdata)
        except ValueError:
            errors["data"] = [u"Preset data must be valid JSON"]
        else:
            proferrors = preset.profile.validate_preset(data)
            if proferrors:
                errors["profile"] = proferrors
        if errors:
            return HttpResponse(json.dumps(
                dict(description="Invalid preset", errors=errors)),
                    mimetype="application/json")
    preset.data = scriptdata
    preset.save()
    return HttpResponse(preset.data, status=201, mimetype="application/json")

@csrf_exempt
def download(request, slug):
    """Return the data for a preset as an attachment"""
    preset = get_object_or_404(Preset, slug=slug)
    response = HttpResponse(preset.data, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=%s.json" % slug
    return response


@csrf_exempt
def fetch(request):
    """Hacky method of forcing downloading of an in-progress script via JS"""
    slug = request.POST.get("name", "untitled")
    script = request.POST.get("script")
    response = HttpResponse(script, mimetype="application/json")
    response['Content-Disposition'] = "attachment; filename=%s.json" % slug
    return response


@saves_files
def builder(request, doc=None):
    """
    Show the preset builder.
    """
    context = dict(
            form=PresetForm(initial=dict(user=request.user)),
            presets=Preset.objects.order_by("name"),
            profiles=Preset.objects.order_by("name"),
            doc=doc,
            ref=request.GET.get("ref", "/documents/list")
    )
    return render(request, "presets/builder.html", context)


@project_required
def builder_doc_edit(request, pid):
    """Show the preset builder for a specific document script."""
    doc = request.project.get_storage().get(pid)
    return builder(request, doc)


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

@csrf_exempt
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
    try:
        aspect = float(request.POST.get("aspect"))
    except TypeError:
        aspect = None
    nodes = json.loads(jsonscript)
    return HttpResponse(
            json.dumps(graph.get_node_positions(nodes, aspect)),
                mimetype="application/json")


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


