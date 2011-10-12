# Fedora Commons Datastream Object

import utils
reload(utils)
import fcbase
reload(fcbase)


from datetime import datetime
from xml.dom import minidom
import urllib

class FedoraDatastream(fcbase.FedoraBase):
    """
        Fedora Datastream.  
    """
    NAMESPACE = None

    # Map attribute names from XML to Object 
    ATTRMAP = {
        "dsid"          :   "dsid",
        "mimeType"		:	"mimetype",
        "dcmDate"	:	"dc_modification_date",
    }

    PROFMAP = {
        "dsID"          : "dsid",
        "dsLabel"       : "label",
        "dsMIME"        : "mimetype",
        "dsInfoType"    : "info_type",
        "dsChecksum"    : "checksum",
        "dsChecksumType"    : "checksum_type",
        "dsCreateDate"  : "creation_date",
        "dsState"       : "state",
        "dsControlGroup"    : "control_group",
        "dsVersionable"     : "versionable",
        "dsSize"        : "size",
        "dsFormatURI"   : "format_uri",
        "dsLocation"    : "location",
        "dsLocationType"    : "location_type",
        "dsVersionID"   : "version_id",
    }

    ATTRIBUTES = [
        "label",
        "creation_date",
        "mimetype",
        "info_type",
        "checksum",
        "checksum_type",
        "format_uri",
        "location",
        "location_type",
        "version_id",
        "versionable",
        "state",
        "size",
    ]

    def __init__(self, *args, **kwargs):
        fcbase.FedoraBase.__init__(self, *args, **kwargs)
        self._loaded = False
        self._saved = True
        self._temp_content = None
        self.pid = kwargs.get("pid")
        self.dsid = kwargs.get("dsid")
        self.label = kwargs.get("dsid")

    @classmethod
    def new(cls, pid, dsid):
        """
            Instantiate a brand-new Datastream ready to be saved.
        """
        ds = cls(pid=pid, dsid=dsid)
        ds._saved = False
        return ds

    @classmethod
    def load_from_xml(cls, pid, xmlnode):
        """
            Load an existing Datastream from XML content.
        """
        ds = cls(pid)
        ds.set_attributes_from_xml(xmlnode)
        return ds 

    def set_content(self, content):
        """
            Set arbitary content attribute.  This could be an XML string,
            or anything that implements the file I/O interface.
        """

        self._temp_content = content
        self._saved = False
        return self

    def set_attributes_from_xml(self, xmlnode):
        """
            Load from listDatastreams XML.
        """
        if xmlnode.nodeName == "datastream":
            for i in range(0, xmlnode.attributes.length):
                attrname = xmlnode.attributes.item(i).nodeName
                value = xmlnode.attributes.item(i).nodeValue 
                try:
                    value = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    pass
                self.__dict__[self.normalise_attrname(attrname)] = value
        elif xmlnode.nodeName == "datastreamProfile":
            self.dsid = xmlnode.getAttribute("dsID")
            self.set_attributes_from_profile_xml(xmlnode)
        return self 

    def set_attribute(self, name, value):
        cattr = self.__dict__.get(name)
        if (not cattr) or (cattr != value):
            self.__dict__[name] = value
            self._saved = False
        return self    
 
    def delete(self):
        """
            Run purgeDatastream on the given dsid
        """
        self._response = self._handler.purgeDatastream(
            self.pid,
            self.dsid
        )
        self._deleted = self._response.getStatus() == "204"  
        return self._deleted

    def save(self):
        """
            Save/modify an object.
        """
        if self._saved:
            return self.save_modified()
        else:
            return self.save_new()

    def save_modified(self):
        """
            Save changes to an object.
        """
        self._response = self._handler.modifyDatastream(
            self.pid,
            self.dsid,
            dsLabel=self.label,
            controlGroup="M",
            mimeType=urllib.quote(self.mimetype),
            contentLength=self.size,
            content=self._temp_content
        )
        print self._response.getBody().getContent()
        print self._response.getStatus()
        return self._response.getStatus() == "201"           

    def save_new(self):
        """
            Save a new the datastream.
        """
        self._response = self._handler.addDatastream(
            self.pid,
            self.dsid,
            dsLabel=self.label,
            controlGroup="M",
            mimeType=urllib.quote(self.mimetype),
            contentLength=self.size,
            content=self._temp_content
        )
        print self._response.getBody().getContent()
        print self._response.getStatus()
        self._temp_content = None
        self._saved = self._response.getStatus() == "201" 
        return self._saved  

    def is_saved(self):
        """
            Return whether the object is newly initialised or loaded from the repository.
        """
        return self._saved
 
    def content(self):
        """
            Return the datastream dissemintation for the object
        """
        self._response = self._handler.getDatastreamDissemination(self.pid, self.dsid, download="true")
        if not self._response != "200":
            raise utils.FedoraAdaptorException("Datastream '%s' for object with pid '%s' not found" % (self.dsid, self.pid))

        return self._response.getBody().getContent()
 

    def _lazy_load_profile(self):
        """
            Parse profile XML to attributes.
        """
        if self._loaded:
            return
        response = self._handler.getDatastream(self.pid, self.dsid, format="xml")
        doc = minidom.parseString(response.getBody().getContent())
        self.set_attributes_from_profile_xml(doc.documentElement)
        self._loaded = True


    def __repr__(self):
        return "<%s %s: %s>" % (self.__class__.__name__, self.dsid, self.mimetype)
