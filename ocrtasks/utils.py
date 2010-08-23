# Miscellaneous task-related functions

from pygments import highlight
from pygments.lexers import PythonLexer
from pygments.formatters import HtmlFormatter
import pprint


def html_format(data):
    """
    Returns a string formatted by Pygments.
    """
    return highlight(pprint.pformat(data, indent=4), 
            PythonLexer(), HtmlFormatter())


def html_format_querydict(data):
    """
    Formats a django querydict as a dict.
    Ignores multi-value items.
    """
    d = {}
    for k in data.iterkeys():
        d[k] = data.get(k)
    return highlight(pprint.pformat(d, indent=4), 
            PythonLexer(), HtmlFormatter())
    
    

