"""
Useful functions and classes for nodes to use.
"""
import os

def hocr_from_data(pagedata):
    """
    Return an HOCR document (as a string).
    """
    from django.template import Template, Context
    with open(os.path.join(os.path.dirname(__file__), "hocr_template.html"), "r") as tmpl:
        t = Template(tmpl.read())
        return t.render(Context(pagedata))
