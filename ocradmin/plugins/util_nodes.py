"""
Nodes to perform random things.
"""

import os
import re
import tempfile
import subprocess as sp
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


class TextFileInNode(generic_nodes.FileNode, generic_nodes.TextWriterMixin):
    """
    Read a text file.  That's it.
    """
    stage = stages.UTILS
    name = "Utils::TextFileIn"
    description = "Read a text file"
    stage = stages.INPUT
    arity = 0
    intypes = []
    outtype = unicode
    _parameters = [dict(name="path", value="", type="filepath")]

    def _eval(self):
        with open(self._params.get("path"), "r") as fh:
            return self.reader(fh)


class SwitchNode(node.Node, writable_node.WritableNodeMixin):
    """
    Node which passes through its selected input.
    """
    name = "Utils::Switch"
    description = "Switch between multiple inputs"
    stage = stages.UTILS
    arity = 2
    _parameters = [dict(name="input", value=0, type="switch")]

    def __init__(self, *args, **kwargs):
        super(SwitchNode, self).__init__(*args, **kwargs)
        self.arity = kwargs.get("arity", 2)
        self.intypes = [object for i in range(self.arity)]
        self.outtype = object

    def _eval(self):
        """
        Pass through the selected input.
        """
        input = int(self._params.get("input", 0))        
        return self.eval_input(input)

    def set_input(self, num, n):
        """
        Override the base set input to dynamically change our
        in and out types.
        """
        super(SwitchNode, self).set_input(num, n)
        input = int(self._params.get("input", 0))
        if input == num:
            self.outtype = self._inputs[input].outtype

    def first_active(self):
        if self.arity > 0 and self.ignored:
            return self._inputs[self.passthrough].first_active()
        input = int(self._params.get("input", 0))
        return self._inputs[input].first_active()

    def get_file_name(self):
        input = int(self._params.get("input", 0))
        if self.input(input):
            return "%s%s" % (self.input(input), self.input(input).extension)
        return "%s%s" % (self.input(input), self.extension)

    def writer(self, path, data):
        """
        Pass through the writer function from the selected node.
        """
        input = int(self._params.get("input", 0))
        if self.input(input):
            return self.input(input).writer(path, data)
        
    def reader(self, path):
        """
        Pass through the writer function from the selected node.
        """
        input = int(self._params.get("input", 0))
        if self.input(input):
            return self.input(input).reader(path)
        

class FileOutNode(node.Node):
    """
    A node that writes a file to disk.
    """
    name = "Utils::FileOut"
    description = "File output node"
    arity = 1
    stage = stages.OUTPUT
    _parameters = [dict(name="path", value="", type="filepath")]

    def _validate(self):
        """
        Check params are OK.
        """
        if self._params.get("path") is None:
            raise node.ValidationError(self, "'path' not set")

    def null_data(self):
        """
        Return the input.
        """
        next = self.first_active()
        if next is not None:
            return next.eval()

    def _eval(self):
        """
        Write the input to the given path.
        """
        input = self.eval_input(0)
        if input is None:
            return
        path = self._params.get("path")
        with open(path, "w") as fh:
            self._inputs[0].writer(fh, input)
        return input


class TextEvaluationNode(node.Node, generic_nodes.TextWriterMixin):
    """
    Evaluate two text inputs with ISRI accuracy program.
    """
    name = "Utils::TextEvaluation"
    description = "Evaluate two text inputs with ISRI accuracy."
    stage = stages.UTILS
    arity = 2
    intypes = [basestring, basestring]
    outtype = basestring
    _parameters = []

    def _eval(self):
        intext = self.eval_input(0)
        gttext = self.eval_input(1)
        with tempfile.NamedTemporaryFile(delete=False) as t1:
            with tempfile.NamedTemporaryFile(delete=False) as t2:
                self.writer(t1, gttext)
                self.writer(t2, intext)
        p = sp.Popen(["accuracy", t1.name, t2.name], stdout=sp.PIPE)
        report = p.communicate()[0]
        os.unlink(t1.name)
        os.unlink(t2.name)
        return report




    
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
        elif name == "TextFileIn":
            return TextFileInNode(**kwargs)
        elif name == "Switch":
            return SwitchNode(**kwargs)
        elif name == "FileOut":
            return FileOutNode(**kwargs)
        elif name == "TextEvaluation":
            return TextEvaluationNode(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())

if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n




