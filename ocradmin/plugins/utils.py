"""
Useful functions and classes for nodes to use.
"""
import os
from lxml import etree
from cStringIO import StringIO

from ocradmin.plugins import cache


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
        raise ImproperlyConfigured(                    
                "Error importing base cache module '%s'" % settings.NODETREE_PERSISTANT_CACHER)
    return cacher


def fix_preset_db_naming():
    """Convert old nodetree naming to new scheme."""
    from ocradmin.presets import models
    import re
    regex = "\"([A-Za-z0-9]+)::([A-Za-z0-9]+)\""
    def repl(match):
        modname = match.group(1).lower()
        if modname == "utils":
            modname = "util"
        return "\"%s.%s\"" % (modname, match.group(2))

    for p in models.Preset.objects.all():
        p.data = re.sub(regex, repl, p.data)
        p.save()


