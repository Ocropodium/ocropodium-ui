"""
Useful functions and classes for nodes to use.
"""

from __future__ import absolute_import

import os
import re
import tempfile
import subprocess as sp
from lxml import etree

from . import cache, exceptions


def hocr_from_data(pagedata):
    """
    Return an HOCR document (as a string).
    """
    from django.template import Template, Context
    with open(os.path.join(os.path.dirname(__file__), "hocr_template.html"), "r") as tmpl:
        t = Template(tmpl.read())
        return unicode(t.render(Context(pagedata)))


def hocr_from_abbyy(abbyyxml):
    """
    Apply some XSL to transform Abbyy XML to HOCR.
    """
    with open(os.path.join(os.path.dirname(__file__), "abbyy2hocr.xsl"), "r") as tmpl:
        with open(abbyyxml, "r") as abbyy:
            xsl = etree.parse(tmpl)
            xml = etree.parse(abbyy)
            transform = etree.XSLT(xsl)
            return unicode(transform(xml))


def get_cacher(settings):
    cache_path = settings.NODETREE_PERSISTANT_CACHER.split('.')
    # Allow for Python 2.5 relative paths
    if len(cache_path) > 1:
        cache_module_name = '.'.join(cache_path[:-1])
    else:
        cache_module_name = '.'
    cache_module = __import__(cache_module_name, {}, {}, cache_path[-1])
    cacher = getattr(cache_module, cache_path[-1])
    return cacher


def get_dzi_cacher(settings):
    try:            
        cachebase = get_cacher(settings)
        cacher = cache.DziFileCacher
        cacher.__bases__ = (cachebase,)
    except ImportError:
        raise exceptions.ImproperlyConfigured(                    
                "Error importing base cache module '%s'" % settings.NODETREE_PERSISTANT_CACHER)
    return cacher


def lookup_model_file(modelname):
    """
    Lookup the filename of a model from its
    database name.
    """
    from ocradmin.ocrmodels.models import OcrModel
    mod = OcrModel.objects.get(name=modelname)
    assert os.path.exists(mod.file.path), \
            "Model file does not exist: %s" % mod.file.path
    return mod.file.path.encode()


def get_binary(binname):
    """
    Try and find where Tesseract is installed.
    """
    bin = sp.Popen(["which", binname], 
            stdout=sp.PIPE).communicate()[0].strip()
    if bin and os.path.exists(bin):
        return bin

    for path in ["/usr/local/bin", "/usr/bin"]:
        binpath = os.path.join(path, binname) 
        if os.path.exists(binpath):
            return binpath
    # fallback...
    return binname


def set_progress(logger, progress_func, step, end, granularity=5):
    """
    Call a progress function, if supplied.  Only call
    every 5 steps.  Also set the total todo, i.e. the
    number of lines to process.
    """
    if progress_func is None:
        return
    if not (step and end):
        return
    if step != end and step % granularity != 0:
        return
    perc = min(100.0, round(float(step) / float(end), 2) * 100)
    progress_func(perc, end)


def check_aborted(method):
    def wrapper(*args, **kwargs):
        instance = args[0]
        if instance.abort_func is not None:
            if instance.abort_func():
                instance.logger.warning("Aborted")
                raise AbortedAction(method.func_name)
        return method(*args, **kwargs)
    return wrapper


def convert_to_temp_image(imagepath, suffix="tif"):
    """
    Convert PNG to TIFF with GraphicsMagick.  This seems
    more reliable than PIL, which seems to have problems
    with Group4 TIFF encoders.
    """
    with tempfile.NamedTemporaryFile(suffix=".%s" % suffix) as tmp:
        tmp.close()
        retcode = sp.call(["convert", imagepath, tmp.name])
        if not retcode == 0:
            raise ExternalToolError(
                "convert failed to create TIFF file with errno %d" % retcode) 
        return tmp.name

def fix_preset_db_naming():
    """Convert old nodetree naming to new scheme."""
    from ocradmin.presets import models
    regex = "\"([A-Za-z0-9]+)::([A-Za-z0-9]+)\""
    def repl(match):
        modname = match.group(1).lower()
        if modname == "utils":
            modname = "util"
        return "\"%s.%s\"" % (modname, match.group(2))

    for p in models.Preset.objects.all():
        p.data = re.sub(regex, repl, p.data)
        p.save()


