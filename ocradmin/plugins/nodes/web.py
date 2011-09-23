"""
Nodes that use web services to do something.
"""

import json
import httplib2
import urllib
from BeautifulSoup import BeautifulSoup

from nodetree import node
from . import generic
from .. import stages


class WebServiceNodeError(node.NodeError):
    pass


class BaseWebService(node.Node, generic.TextWriterMixin):
    """
    Base class for web service nodes.
    """
    abstract = True
    stage = stages.POST
    intypes = [unicode]
    outtype = unicode


class MashapeProcessing(BaseWebService):
    """
    Mashape entity extraction.
    """
    stage = stages.POST
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


class DBPediaAnnotate(BaseWebService):
    """
    Mashape entity extraction.
    """
    stage = stages.POST
    baseurl = "http://spotlight.dbpedia.org/rest/annotate/"
    _parameters = [
        dict(name="confident", value=0.2),
        dict(name="support", value=20),
    ]

    def _eval(self):
        input = self.eval_input(0)
        
        http = httplib2.Http()
        headers = {}
        body = dict(
                text=input.encode("utf8", "replace"),
                confidence=self._params.get("confident"),
                support=self._params.get("support"),
        )
        url = "%s?%s" % (self.baseurl, urllib.urlencode(body))
        request, content = http.request(url, "GET", headers=headers)
        if request["status"] != "200":
            raise WebServiceNodeError(self, "A web service error occured.  Status: %s" % request["status"])
        out = u""
        soup = BeautifulSoup(content)
        for ref in soup.findAll("a"):
            out += "%s\n" % ref.text
            out += "   %s\n\n" % ref.get("href")
        return out


class OpenCalais(BaseWebService):
    """
    OpenCalias sematic markup.
    """
    stage = stages.POST
    baseurl =  "http://api.opencalais.com/tag/rs/enrich"
    _parameters = [
    ]

    def _eval(self):
        input = self.eval_input(0)
        
        http = httplib2.Http()
        headers = {
                "x-calais-licenseID": "dsza6q6zwa9nzvz9wbz7f6y5",
                "content-type": "text/raw",
                "Accept": "xml/rdf",
                "enableMetadataType": "GenericRelations",
        }
        request, content = http.request(
                self.baseurl,
                "POST",
                headers=headers,
                body=input.encode("utf8")
        )
        if request["status"] != "200":
            raise WebServiceNodeError(self, "A web service error occured.  Status: %s" % request["status"])
        return content.decode("utf8")


