"""
Nodes to perform random things.
"""

import re
from nodetree import node, writable_node, manager
from ocradmin.plugins import stages, generic_nodes, types

NAME = "Utils"

from HTMLParser import HTMLParser

class HTMLContentHandler(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self)
        self._data = []
        self._ctag = None
        self._cattrs = None

    def data(self):
        return "".join(self._data)

    def content_data(self, data, tag, attrs):
        """ABC method.  Does nothing by default."""
        return data

    def parsefile(self, filename):
        with open(filename, "r") as f:
            for line in f.readlines():
                self.feed(line)
        return self.data()

    def parse(self, string):
        self._data = []
        self.feed(string)
        return self.data()

    def handle_decl(self, decl):
        self._data.append("<!%s>" % decl)

    def handle_comment(self, comment):
        self._data.append("<!-- %s -->" % comment)

    def handle_starttag(self, tag, attrs):
        """Simple add the tag to the data stack."""
        self._ctag = tag
        self._cattrs = attrs
        self._data.append(
                "<%s %s>" % (tag, " ".join(["%s='%s'" % a for a in attrs])))

    def handle_data(self, data):
        self._data.append(self.content_data(
                data, self._ctag, self._cattrs))

    def handle_endtag(self, tag):
        self._data.append("</%s>" % tag)


class HocrToText(HTMLParser):
    """
    Get text from a HOCR document.
    """
    def __init__(self):
        HTMLParser.__init__(self)
        self._text = []
        self._gotline = False

    def parsefile(self, filename):
        self._text = []
        with open(filename, "r") as f:
            for line in f.readlines():
                self.feed(line)
        return "\n".join(self._text)

    def parse(self, string):
        self._text = []
        self.feed(string)
        return "\n".join(self._text)

    def handle_starttag(self, tag, attrs):
        for name, val in attrs:
            if name == "class" and val.find("ocr_line") != -1:
                self._gotline = True
            if name == "br":
                self._text.append("\n")

    def handle_data(self, data):
        if self._gotline:
            self._text.append(data)

    def handle_endtag(self, tag):
        self._gotline = False
            
        


class FindReplaceNode(node.Node, generic_nodes.TextWriterMixin):
    """
    Find an replace stuff in input with output.
    """
    stage = stages.UTILS
    name = "Utils::FindReplace"
    description = "Find and replace string in HOCR documents"
    arity = 1
    intypes = [types.HocrString]
    outtype = types.HocrString
    _parameters = [
        dict(name="find", value=""),
        dict(name="replace", value=""),
    ]

    def __init__(self, *args, **kwargs):
        super(FindReplaceNode, self).__init__(*args, **kwargs)
        self._findre = None
        self._replace = None

    def _validate(self):
        super(FindReplaceNode, self)._validate()
        try:
            re.compile(self._params.get("find"))
        except Exception, err:
            raise node.ValidationError(self, "find: regular expression error: %s" % err)

    def content_data(self, data, tag, attrs):
        """Replace all content data."""
        return self._findre.sub(self._replace, data)

    def _eval(self):
        """
        Run find/replace on input
        """
        xml = self.eval_input(0)
        find = self._params.get("find", "")
        replace = self._params.get("replace", "")
        if find.strip() == "" or replace.strip() == "":
            return xml
        self._findre = re.compile(find)
        self._replace = replace        
        parser = HTMLContentHandler()
        parser.content_data = self.content_data
        return parser.parse(xml)


class HocrToTextNode(node.Node, generic_nodes.TextWriterMixin):
    """
    Convert HOCR to text.
    """
    stage = stages.UTILS
    name = "Utils::HocrToText"
    description = "Find and replace string in HOCR documents"
    arity = 1
    intypes = [types.HocrString]
    outtype = unicode
    _parameters = []

    def _eval(self):
        input = self.eval_input(0)
        parser = HocrToText()
        return parser.parse(input)




    
class Manager(manager.StandardManager):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        if name == "FindReplace":
            return FindReplaceNode(**kwargs)
        elif name == "HocrToText":
            return HocrToTextNode(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())

if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n




