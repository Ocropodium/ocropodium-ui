# Fedora Commons Object

import re
from utils import FedoraException, FedoraAdaptor
from ordereddict import OrderedDict

import fcbase
reload(fcbase)
import fcdatastream
reload(fcdatastream)

import risearch
reload(risearch)

from datetime import datetime
from xml.dom import minidom
import urllib

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
 
class FedoraObject(fcbase.FedoraBase):
    """
        Fedora Object.  
    """
    NAMESPACE = "fedora-object"
    DSIDBASE = "DS"
    CONTENT_MODEL = "fedora-system:ContentModel-3.0"

    # Map attribute names from XML to Object 
    ATTRMAP = {
        "ownerId"   :	"owner_id",
        "cDate"		:	"creation_date",
        "mDate"		:	"modification_date",
        "dcmDate"	:	"dc_modification_date",
    }

    PROFMAP = {
        "objLabel": "label",
        "objOwnerId" : "owner_id",
        "objCreateDate" : "creation_date",
        "objLastModDate" : "modification_date",
    }

    ATTRIBUTES = [
        "label",
        "title",
        "creation_date",
        "modification_date",
        "owner_id",
    ]
 
    DUBLINCORE = [
        "title",
        "creator",
        "subject",
        "description",
        "publisher",
        "contributers",
        "date",
        "type",
        "format",
        "identifier",
        "source",
        "language",
        "relation",
        "coverage",
        "rights",
    ]
 
    
    def __init__(self, pid=None):
        fcbase.FedoraBase.__init__(self)
        self._loaded = False
        self._deleted = False
        if pid:
            self.pid = pid
            self._saved = True
        else:
            self.pid = None
            self._saved = False

    def save(self):
        """
            Ingest or update the object in the
            repository.
        """
        if not self.pid:
            self.pid = self.get_next_pid(namespace=self.NAMESPACE)
            # FIXME: Using the actual objects pid here doesn't seem to work
            # so we add it to the FOXML and use "new" instead.
            self._response = self._handler.ingest(pid="new", content=self.to_foxml())
            self._saved = self._response.getStatus() == "201"  
            return self._saved
        else:
            # update the object
            pass
    
    def is_saved(self):
        """
            Return whether the object is newly initialised or loaded from the repository.
        """
        return self._saved

    def delete(self, msg=""):
        """
            Purge an object from the repository.
        """
        self._response = self._handler.purgeObject(pid=self.pid, logMessage=msg)
        self._deleted = self._response.getStatus() == "204"
        return self._deleted

    def set_attribute(self, name, value):
        cattr = self.__dict__.get(name)
        if (not cattr) or (cattr != value):
            self.__dict__[name] = value
            self._saved = False
        return self    

    def set_attributes_from_xml(self, xmlnode):
        """
            Load from query XML data.
        """
        for ele in xmlnode.getElementsByTagName("*"):
            if ele.nodeName == "pid":
                continue
            if not ele.childNodes:
                continue
            value = ele.childNodes[0].nodeValue
            try:
                value = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
            self.__dict__[self.normalise_attrname(ele.nodeName)] = value
        return self


    def _lazy_load_profile(self):
        """
            Parse profile XML to attributes.
        """
        if self._loaded:
            return
        response = self._handler.getObjectProfile(pid=self.pid, format="xml")
        doc = minidom.parseString(response.getBody().getContent())
        self.set_attributes_from_profile_xml(doc.documentElement)
        self._loaded = True

        
    def to_xml(self):
        """
            Flatten to an XML string.
        """

        attrs = {}
        for attr, value in self.__dict__.iteritems():
            if attr.startswith("_"):
                continue
            if isinstance(value, datetime):
                attrs[self.normalise_attrname(attr)] = value.strftime("%F %T")
            else:
                attrs[self.normalise_attrname(attr)] = str(value)

        raise NotImplementedError

    def to_foxml(self):
        """
            Flatten to a Fedora Object XML string.        
        """

        # there seems to be a problem with ingesting with a set pid.  As a workaround
        # set the pid in the FOXML and hope that works
        pid = self.__dict__.get("pid")
        if not pid:
            pid = self.get_next_pid()

        doc = minidom.Document()
        root = doc.createElement("foxml:digitalObject")
        doc.appendChild(root)        
        root.setAttribute("VERSION", "1.1")
        root.setAttribute("PID", pid)
        root.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        root.setAttribute("xmlns:foxml", "info:fedora/fedora-system:def/foxml#")
        root.setAttribute("xsi:schemaLocation", "info:fedora/fedora-system:def/foxml# http://www.fedora.info/definitions/1/0/foxml1-1.xsd")
        objprops = doc.createElement("foxml:objectProperties")
        root.appendChild(objprops)
        stateprop = doc.createElement("foxml:property")
        stateprop.setAttribute("NAME", "info:fedora/fedora-system:def/model#state")
        stateprop.setAttribute("VALUE", "A")
        labelprop = doc.createElement("foxml:property")
        labelprop.setAttribute("NAME", "info:fedora/fedora-system:def/model#label")
        labelprop.setAttribute("VALUE", self.__dict__.get("label", ""))
        ownerprop = doc.createElement("foxml:property")
        ownerprop.setAttribute("NAME", "info:fedora/fedora-system:def/model#ownerId")
        ownerprop.setAttribute("VALUE", self.__dict__.get("creator", ""))
        for p in [stateprop, labelprop, ownerprop]:
            objprops.appendChild(p)

        dcstream = doc.createElement("foxml:datastream")
        root.appendChild(dcstream)
        dcstream.setAttribute("ID", "DC")
        dcstream.setAttribute("STATE", "A")
        dcstream.setAttribute("CONTROL_GROUP", "X")

        dcstreamver = doc.createElement("foxml:datastreamVersion")
        dcstream.appendChild(dcstreamver)
        dcstreamver.setAttribute("ID", "DC.0")
        dcstreamver.setAttribute("MIMETYPE", "text/xml")
        dcstreamver.setAttribute("LABEL", "Default Dublin Core Record")

        dcxml = doc.createElement("foxml:xmlContent")
        dcstreamver.appendChild(dcxml)
        dcroot = doc.createElement("oai_dc:dc")
        dcxml.appendChild(dcroot)
        dcroot.setAttribute("xmlns:dc", "http://purl.org/dc/elements/1.1/")
        dcroot.setAttribute("xmlns:oai_dc", "http://www.openarchives.org/OAI/2.0/oai_dc/")
        
        for attr in ["date", "title", "creator", "description"]:
            dcattr = doc.createElement("dc:%s" % attr)
            dcroot.appendChild(dcattr)
            dcattr.appendChild(doc.createTextNode(str(self.__dict__.get(attr, ""))))         

        relsextstream = doc.createElement("foxml:datastream")
        root.appendChild(relsextstream)
        relsextstream.setAttribute("ID", "RELS-EXT")
        relsextstream.setAttribute("STATE", "A")
        relsextstream.setAttribute("CONTROL_GROUP", "X")
        relsextstream.setAttribute("VERSIONABLE", "true")

        relsextstreamver = doc.createElement("foxml:datastreamVersion")
        relsextstream.appendChild(relsextstreamver)
        relsextstreamver.setAttribute("ID", "RELS-EXT.0")
        relsextstreamver.setAttribute("MIMETYPE", "application/rdf+xml")
        relsextstreamver.setAttribute("LABEL", "RDF")
        
        # <rdf:RDF
        #    xmlns:fedora-model="info:fedora/fedora-system:def/model#"
        #    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        rdfxml = doc.createElement("foxml:xmlContent")        
        relsextstreamver.appendChild(rdfxml)
        rdfroot = doc.createElement("rdf:RDF")
        rdfxml.appendChild(rdfroot)
        rdfroot.setAttribute("xmlns:fedora-model", "info:fedora/fedora-system:def/model#")
        rdfroot.setAttribute("xmlns:rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#")

        rdfdesc = doc.createElement("rdf:Description")
        rdfroot.appendChild(rdfdesc)
        rdfdesc.setAttribute("rdf:about", "info:fedora/%s" % pid)
        rdfmodel = doc.createElement("fedora-model:hasModel")
        rdfdesc.appendChild(rdfmodel)
        rdfmodel.setAttribute("rdf:resource", "info:fedora/%s" % self.CONTENT_MODEL)

        return doc.toxml()

    def from_foxml(self, foxml):
        """
            Load object from a Fedora Object XML string.
        """

        doc = minidom.parseString(foxml)
        root = doc.documentElement


    def datastream(self, dsid):
        self._response = self._handler.getDatastream(self.pid, dsid, format="xml")
        if self._response.getStatus() != "200":
            raise FedoraException("Datastream '%s' for object with pid '%s' not found" % (dsid, self.pid))
        rdoc = minidom.parseString(self._response.getBody().getContent())
        return fcdatastream.FedoraDatastream.load_from_xml(self.pid, rdoc.documentElement)   


    def datastreams(self):
        self._response = self._handler.listDatastreams(self.pid, format="xml")
        rdoc = minidom.parseString(self._response.getBody().getContent())
        ds = []
        for item in rdoc.getElementsByTagName("datastream"):
            d = fcdatastream.FedoraDatastream.load_from_xml(self.pid, item)
            ds.append(d)

        return ds

    def delete_datastream(self, dsid):
        """
            Run purgeDatastream on the given dsid
        """

        self._response = self._handler.purgeDatastream(
            self.pid,
            dsid
        )

        return self._response.getStatus() == "204"

    def add_datastream(self, *args, **kwargs):
        """
            Add a new datastream to the object.
        """
        print "Calling FedoraObject add_datastream"
        ds = self.new_datastream(*args, **kwargs)
        return ds.save()

    def new_datastream(self, dsid, label=None, content=None, content_type=None, content_length=None):
        """
            Return a new datastream for this object.
        """

        ds = fcdatastream.FedoraDatastream.new(self.pid, dsid)
        ds.set_attribute("label", label)
        ds.set_attribute("mimetype", content_type)
        ds.set_attribute("size", content_length)
        ds.set_content(content)
        return ds

#    def add_relationship(self, relobject, reldesc):
#        """
#            Set a relationship to another object in this object's RELS-EXT.
#        """
#
#        rels = self.relationships()
#        for rel in rels:
#            desc, pid = rel
#            if relobject.pid == pid and reldesc == desc:
#                return self
#        rels.append((reldesc, relobject.pid))
#        return self.set_relationships(rels)

#    def related_by(self, desctype):
#        rels = self.relationships()
#        relpids = []
#        for desc, pid in rels:
#            if desctype == desc:
#                relpids.append(pid)
#        querystr = 

    def find_related_by(self, reldesc):
        """
            Query relationships with risearch.  
            TODO: Turn this into a reuseable module.
        """

        query = "select $object from <#ri> where $object <fedora-rels-ext:%s> <info:fedora/%s>" % (
            reldesc,
            self.pid
        )
        ri = risearch.RiSearch("http://localhost:8080/fedora/risearch")
        response = ri.query(query)

        # parse the response into a set of results
        objects = []
        rdoc = minidom.parseString(response)
        for result in rdoc.documentElement.getElementsByTagName("object"):
            pid = result.getAttribute("uri").replace("info:fedora/", "", 1)            
            objects.append(FedoraObject(pid))

        return objects



        

    def relationships(self):
        """
            Get list of RELS-EXT data.  Each item is a tuple containing
            the relationship description and the related object pid.
        """
        self._response = self._handler.getDatastreamDissemination(self.pid, "RELS-EXT", format="xml")
        # return an empty dict if nothing was found
        if self._response.getStatus() == "404":
            return []
        rdoc = minidom.parseString(self._response.getBody().getContent())
        rels = []
        for ele in rdoc.documentElement.getElementsByTagName("rdf:Description"):
            # skip descriptions for other subjects
            subject = ele.getAttribute("rdf:about")
            if not subject.endswith(self.pid):
                continue
            for relele in ele.getElementsByTagName("*"):
                desc = relele.nodeName.replace("rel:", "", 1)
                pid = relele.getAttribute("rdf:resource").replace("info:fedora/", "", 1)
                rels.append((desc, pid))
        return rels

    def set_relationships(self, rels):
        """
            Set RELS-EXT relationships.
        """
        # determine the rdf content from the rels tuples
        rdfxml = self._relations_rdf(rels)
        self._response = self._handler.getDatastreamDissemination(self.pid, "RELS-EXT", format="xml")
        if self._response.getStatus() == "404":
            ds = self.new_datastream("RELS-EXT", content_type="application/rdf+xml", content=rdfxml)
            if not ds.save():
                return False
        self._response = self._handler.modifyDatastream(self.pid, "RELS-EXT", content=rdfxml)
        return self._response.getStatus() == "201"

    def set_relationship(self, reldesc, relto):
        """
            Set a single RELS-EXT relationship.
        """
        rels = self.relationships()
        for desc, subject in rels:
            if desc == reldesc and subject == relto.pid:
                return True
        rels.append((reldesc, relto.pid))
        return self.set_relationships(rels)



    def dublincore(self):
         self._response = self._handler.getDatastreamDissemination(self.pid, "DC", format="xml")
         rdoc = minidom.parseString(self._response.getBody().getContent())
         dc = OrderedDict([(a,"") for a in self.DUBLINCORE])
         for ele in rdoc.documentElement.getElementsByTagName("*"):
             try:
                 value = ele.childNodes[0].nodeValue
             except IndexError:
                 value = ""
             dc[ele.nodeName.replace("dc:", "", 1) ] = value
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
         return self._response.getStatus() == "201"

    def next_dsid(self):
        # if we've not been given an id, get the next logical one
        dsnums = []
        newdsid = self.DSIDBASE + "1"
        for ds in self.datastreams():
            dsidmatch = re.match("^%s(\d+)$" % self.DSIDBASE, ds.dsid)
            if dsidmatch:
                dsnums.append(int(dsidmatch.groups()[0]))
        if dsnums:
            maxdsid = sorted(dsnums)[-1]
            newdsid = "%s%d" % (self.DSIDBASE, maxdsid + 1) 
        return newdsid


    def _relations_rdf(self, rels):
        """
            Get RDF from a list of relationship -> subject tuples.
        """
        doc = minidom.Document()
        rdfroot = doc.createElement("rdf:RDF")
        doc.appendChild(rdfroot)
        rdfroot.setAttribute("xmlns:fedora-model", "info:fedora/fedora-system:def/model#")
        rdfroot.setAttribute("xmlns:rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#")
        rdfroot.setAttribute("xmlns:fedora-rels-ext", "info:fedora/fedora-system:def/relations-external#")

        rdfdesc = doc.createElement("rdf:Description")
        rdfroot.appendChild(rdfdesc)
        rdfdesc.setAttribute("rdf:about", "info:fedora/%s" % self.pid)
        # make sure the content model is always set
        if not "fedora-model:hasModel" in [rel[0] for rel in rels]:
            rels.append(("fedora-model:hasModel", "info:fedora/%s" % self.CONTENT_MODEL))
        for desc, subject in rels:
            dnode = doc.createElement(desc)
            dnode.setAttribute("rdf:resource", "info:fedora/%s" % subject)
            rdfdesc.appendChild(dnode)

        return doc.toxml()


    def __eq__(self, other):
        return self.pid == other.pid


    def __repr__(self):
        return "<%s: %s>" % (self.__class__.__name__, self.__dict__.get("pid"))
