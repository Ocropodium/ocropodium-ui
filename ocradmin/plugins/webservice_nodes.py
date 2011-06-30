"""
Nodes that use web services to do something.
"""

NAME = "WebService"

from nodetree import node, manager
from ocradmin.plugins import generic_nodes, stages

import json
import httplib2
import urllib


class WebServiceNodeError(node.NodeError):
    pass


class MashapeProcessingNode(node.Node, generic_nodes.TextWriterMixin):
    """
    Convert HOCR to text.
    """
    stage = stages.POST
    name = "%s::MashapeProcessing" % NAME
    description = "Perform phrase or sentiment extraction"
    arity = 1
    intypes = [unicode]
    outtype = unicode
    baseurl = "http://text-processing.com/api/"
    _parameters = [
        dict(name="extract", value="phrases", choices=["phrases", "sentiment"]),
    ]

    def _eval(self):
        input = self.eval_input(0)
        
        http = httplib2.Http()
        headers = {}
        body = dict(text=input[:10000].encode("utf8", "replace"))
        url = "%s/%s/" % (self.baseurl, self._params.get("extract", "phrases"))
        request, content = http.request(url, "POST", headers=headers, body=urllib.urlencode(body))
        if request["status"] == "503":
            raise WebServiceNodeError(self, "Daily limit exceeded")
        elif request["status"] == "400":
            raise WebServiceNodeError(self, "No text, limit exceeded, or incorrect language")
        out = u""
        try:
            data = json.loads(content)
        except ValueError:
            return content
        for key in ["GPE", "VP", "LOCATION", "NP", "DATE"]:
            keydata = data.get(key)
            if keydata is not None:
                out += "%s\n" % key
                for entity in keydata:
                    out += "   %s\n" % entity
        return out








class Manager(manager.StandardManager):
    """
    Handle Webservice.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        g = globals()
        if g.get(name + "Node"):            
            return g.get(name + "Node")(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())

if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n




