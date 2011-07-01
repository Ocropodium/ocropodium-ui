"""
Useful functions and classes for nodes to use.
"""
import os
from lxml import etree
from cStringIO import StringIO

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


