# fedora adaptor

import re

from fcrepo.http.restapi import FCRepoRestAPI
import xml.etree.cElementTree as elementtree
from cStringIO import StringIO

from xml.dom import minidom


DEFAULTS = {
        "repository_url": 'http://optiplex:8080/fedora',
        "username": 'fedoraAdmin',
        "password": 'fedora',
        "realm": 'any',
        "namespace": 'fedora'
}

NS = "{http://www.fedora.info/definitions/1/0/types/}"
DCNS = "{http://purl.org/dc/elements/1.1/}"


RESPONSEMAP = {
    

}


class FedoraException(Exception):
    pass


class FedoraAdaptorException(Exception):
    pass

def add_ns(tag):
     return "%s%s" % (NS, tag) 

def strip_ns(tag, ns=None):
    if ns is None:
        ns = NS
    return tag.replace(ns, "", 1)

def query_args(argdict):
    args = {}
    for arg, val in argdict.iteritems():
        if arg.startswith("_"):
            continue
        if isinstance(val, bool):
            args[arg] = str(val).lower()
        else:
            args[arg] = str(val)
    return args


class FedoraDatastream(object):
    def __init__(self, pid, handler):
        self.pid = pid
        self._handler = handler

    @classmethod
    def from_xml(cls, pid, handler, xml):
        fd = FedoraDatastream(pid, handler)

        #for tag, val in xml.attrib.iteritems():
        #    fd.__dict__[tag] = val
        
        for dsnode in xml.getElementsByTagName("datastreamProfile"):
            print dsnode.attributes
            for i in range(0, dsnode.attributes.length):
                attr = dsnode.attributes.item(i)
                fd.__dict__[attr.nodeName.encode()] = attr.nodeValue.encode()
                print attr.nodeName, attr.nodeValue
            for propnode in dsnode.childNodes:
                if propnode.nodeName == "dsMIME":
                    fd.__dict__["mimeType"] = propnode.childNodes[0].nodeValue   
                elif propnode.nodeName == "dsID":
                    print "GOT DSID!"
                    fd.__dict__["dsid"] = propnode.childNodes[0].nodeValue   
                elif propnode.nodeName.startswith("ds"):
                    attrname = propnode.nodeName.replace("ds", "", 1)
                    print attrname
                    attrname = "%s%s" % (attrname[0].lower(), attrname[1:])
                    try:
                        fd.__dict__[attrname.encode()] = propnode.childNodes[0].nodeValue             
                    except IndexError:
                        fd.__dict__[attrname.encode()] = "" 
        try:
            fd.__dict__["dsid"] = fd.dsID
        except Exception: pass

        return fd

    def content(self):
        """
            Return the datastream dissemintation for the object
        """
        response = self._handler.getDatastreamDissemination(self.pid, self.dsid, download="true")
        if not response != "200":
            raise FedoraAdaptorException("Datastream '%s' for object with pid '%s' not found" % (self.dsid, self.pid))

        return response.getBody().getContent()

    def __repr__(self):
        return "<%s: %s>" % (self.__class__.__name__, self.__dict__)



class FedoraObject(object):
    _handler = None
    _dsidbase = "DS"
    def __init__(self, *args, **kwargs):        
        self._handler = kwargs.get("handler") or FCRepoRestAPI(**DEFAULTS)
        try:
            del kwargs["handler"]
        except KeyError:
            pass
        for key, value in kwargs.iteritems():
            self.__dict__[key] = value


    @classmethod
    def find(cls, pid):
        if not cls._handler:
            cls._handler = FCRepoRestAPI(**DEFAULTS)
        response = cls._handler.getObjectProfile(pid=pid, format="xml")
        if not response.getStatus() == "200":
            raise FedoraAdaptorException("Object with pid '%s' not found" % pid)

        initattrs = {"handler": cls._handler, "pid": pid}
        rdoc = minidom.parseString(response.getBody().getContent())
        for objnode in rdoc.getElementsByTagName("objectProfile"):
            for propnode in objnode.childNodes:
                if propnode.nodeName.startswith("obj"):
                    attrname = propnode.nodeName.replace("obj", "", 1)
                    attrname = "%s%s" % (attrname[0].lower(), attrname[1:])
                    initattrs[attrname.encode()] = propnode.childNodes[0].nodeValue
        return cls(**initattrs)




    @classmethod
    def from_xml(cls, handler, xml):
        fo = FedoraObject(handler)
        for subele in xml.getchildren():
            print "%-10s : %s" % (subele.tag, subele.text)
            fo.__dict__[strip_ns(subele.tag)] = subele.text
        return fo

    @classmethod
    def from_pid(cls, handler, pid):
        fo = FedoraObject(handler)
        fo.__dict__["pid"] = pid
        return fo

    def history(self):
        self._response = self._handler.getObjectHistory(self.pid)
        return self._response

    def dublincore(self):
         self._response = self._handler.getDatastreamDissemination(self.pid, "DC", format="xml")
         parsetree = elementtree.parse(StringIO(self._response.getBody().getContent()))
         dc = {}
         for node in parsetree.getroot().getchildren():
             dc[strip_ns(node.tag, DCNS)] = node.text

         return dc

    def set_dublincore(self, dc):
         self._response = self._handler.getDatastreamDissemination(self.pid, "DC", format="xml")
         dcdoc = minidom.parseString(self._response.getBody().getContent())
         root = dcdoc.documentElement
         root.childNodes = []                  
         for key, value in dc.iteritems():
             n = dcdoc.createElement("dc:%s" % key)
             n.appendChild(dcdoc.createTextNode(value))
             root.appendChild(n)

         self._response = self._handler.modifyDatastream(self.pid, "DC", content=dcdoc.toxml())
         print "MODIFY STATUS: " + self._response.getStatus()
         return self._response.getStatus() == "201"

    def save(self, raise_on_error=True):
        self._response = self._handler.ingest(**query_args(self.__dict__))
        return self._response.getStatus() == "200"

    def errors(self):
        return self._response.getBody().getContent()

    def datastream(self, dsid):
        self._response = self._handler.getDatastream(self.pid, dsid, format="xml")
        if self._response.getStatus() != "200":
            raise FedoraAdaptorException("Datastream '%s' for object with pid '%s' not found" % (dsid, self.pid))
        print self._response.getBody().getContent()
        rdoc = minidom.parseString(self._response.getBody().getContent())
        return FedoraDatastream.from_xml(self.pid, self._handler, rdoc)                                                                 
    def datastreams(self):
        self._response = self._handler.listDatastreams(self.pid, format="xml")
        print self._response.getBody().getContent()

        rdoc = minidom.parseString(self._response.getBody().getContent())
        ds = []
        for item in rdoc.getElementsByTagName("datastream"):
            dsid = item.getAttribute("dsid").encode()
            ds.append(self.datastream(dsid))

        return ds

    def add_datastream(self, content_bytes, content_type=None, content_length=None, dsid=None):
        # if we've not been given an id, get the next logical one
        dsnums = []
        newdsid = self._dsidbase + "1"
        for ds in self.datastreams():
            dsidmatch = re.match("^%s(\d+)$" % self._dsidbase, ds.dsid)
            if dsidmatch:
                dsnums.append(int(dsidmatch.groups()[0]))
        if dsnums:
            maxdsid = sorted(dsnums)[-1]
            newdsid = "%s%d" % (self._dsidbase, maxdsid + 1)

        self._response = self._handler.addDatastream(
            self.pid,
            newdsid,
            controlGroup="M",
            mimeType=content_type,
            contentLength=content_length,
            content=content_bytes
        )
        print "ADD DS STATUS: " + self._response.getStatus() + "    DS ID: " + newdsid
        return self._response.getStatus() == "201"

    def delete_datastream(self, dsid):
        """
            Run purgeDatastream on the given dsid
        """

        self._response = self._handler.purgeDatastream(
            self.pid,
            dsid
        )

        return self._response.getStatus() == "204"

    def __repr__(self):
        return "<FedoraObject: '%s'>" % self.__dict__ 



class FedoraAdaptor(object):
    def __init__(self, *args, **kwargs):
        params = DEFAULTS
        for arg, val in kwargs.iteritems():
            params[arg] = val
        self._handler = FCRepoRestAPI(**params)


    def query(self, *args, **kwargs):
        objects = []
        response = self._handler.findObjects(**query_args(kwargs))
        parsetree = elementtree.parse(StringIO(response.getBody().getContent()))
        for results in parsetree.getroot().findall(add_ns("resultList")):
            for ele in results.findall(add_ns("objectFields")):
                objects.append(FedoraObject.from_xml(self._handler, ele))
        return objects

    def new_object(self, *args, **kwargs):
        response = self._handler.getNextPID(**query_args(kwargs))
        parsetree = elementtree.parse(StringIO(response.getBody().getContent()))
        try:
            nextpid = parsetree.findall("pid")[0].text
            return FedoraObject.from_pid(self._handler, nextpid)
        except IndexError, e:
            raise FedoraException("Unable to retrieve next pid for object.  Last response body: %s" %
                    response.getBody().getContent())

                
    def __getattr__(self, attrname):
        try:
            return self.__dict__[attrname]
        except KeyError:
            return getattr(self._handler, attrname)


