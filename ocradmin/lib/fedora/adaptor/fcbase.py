# Fedora Commons Base Object

import re
import urllib2
from datetime import datetime
from utils import FedoraException
from utils import DEFAULTS

from xml.dom import minidom
from fcrepo.http.restapi import FCRepoRestAPI


def denormalise_query_args(argdict):
    """
        Map Python types to REST query strings.
    """
    args = {}
    for arg, val in argdict.iteritems():
        if arg.startswith("_"):
            continue
        if isinstance(val, bool):
            args[arg] = str(val).lower()
        else:
            args[arg] = str(val)
    return args



class FedoraBase(object):
    """
        Fedora Commons Base Object.  This contains the connection
        settings and underlying query methods.
    """

    NAMESPACE = "fcobject"
    ATTRMAP = {}
    PROFMAP = {}
    ATTRIBUTES = []

    _handler = FCRepoRestAPI(**DEFAULTS)
    
    def __init__(self, *args, **kwargs):
        """
           Initialise a base object.

        """
        pass 

    def errors(self):
        """
            Return the most likely helpful string from the response.
        """
        out = "Unknown error"
        if self.__dict__.get("_response"):
            out = self._response.getBody().getContent()
        return out

    def set_attribute(self, attrname, value):
        raise NotImplementedError

    def set_attributes_from_xml(self, xmlnode):
        raise NotImplementedError

    def set_attributes_from_profile_xml(self, xmlnode):
        """
            Load from the profile XML data.
        """
        for ele in xmlnode.getElementsByTagName("*"):
            try:
                value = ele.childNodes[0].nodeValue
            except IndexError:
                value = ""
            try:
                if re.match("\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", value):
                    value = value[:-5]
                    # FIXME: Correct for timezone/daylight savings?
                    value = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                pass
            self.__dict__[self.normalise_profile_attrname(ele.nodeName)] = value
        return self

    def _lazy_load_profile(self):
        raise NotImplementedError

    def to_xml(self):
        raise NotImplementedError  

    def to_foxml(self):
        raise NotImplementedError
    
    def from_xml(self):
        raise NotImplementedError  

    def __getattr__(self, attrname):
        """
            Lazy load attributes if necessary.
        """

        if self.__dict__.get(attrname):
            return self.__dict__.get(attrname)
        if self.__dict__.get("pid") and attrname in self.ATTRIBUTES:
            self._lazy_load_profile()
            return self.__dict__.get(attrname)
        raise AttributeError("%s object has no attribute '%s'" % ("FedoraObject", attrname)) 

    def set_attributes_from_profile_xml(self, xmlnode):
        """
            Load from the profile XML data.
        """
        for ele in xmlnode.getElementsByTagName("*"):
            try:
                value = ele.childNodes[0].nodeValue
            except IndexError:
                value = ""
            try:
                if value and re.match("\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", value.encode()):
                    value = value[:-5]
                    # FIXME: Correct for timezone/daylight savings?
                    value = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S")
            except ValueError, e:
                print e.message
                pass
            self.__dict__[self.normalise_profile_attrname(ele.nodeName)] = value
        return self

    def _lazy_load_profile(self):
        raise NotImplementedError
    
    @classmethod
    def query(self, *args, **kwargs):
        """
            Query the Fedora Repository and return a list of 
            matching objects.
        """
        # make sure we request a pid, and quote certain params
        kwargs["pid"] = True
        if kwargs.get("query"):
            kwargs["query"] = urllib2.quote(kwargs["query"])
        if kwargs.get("terms"):
            kwargs["terms"] = urllib2.quote(kwargs["terms"])
 
        self._response = self._handler.findObjects(**denormalise_query_args(kwargs))
        if self._response.getStatus().startswith("40"):
            return []
        return self.object_list_from_query_xml(self._response.getBody().getContent())

    @classmethod
    def find(cls, pid):
        """
            Find an object with the given pid.
        """
        response = cls._handler.getObjectProfile(pid=pid, format="xml")
        response.getBody().getContent()
        doc = minidom.parseString(response.getBody().getContent())
        f = cls(pid)
        f.set_attributes_from_profile_xml(doc.documentElement)
        return f
       
    @classmethod
    def object_list_from_query_xml(cls, responsexml):
        objects = []
        rdoc = minidom.parseString(responsexml)
        for item in rdoc.documentElement.getElementsByTagName("objectFields"):
            pid = item.getElementsByTagName("pid")[0].childNodes[0].nodeValue
            f = cls(pid)
            f.set_attributes_from_xml(item)
            objects.append(f)
        return objects

    @classmethod
    def get_next_pid(cls, **kwargs):
        if not kwargs.get("format"):
            kwargs["format"] = "xml"
        response = cls._handler.getNextPID(**kwargs)
        pidlist =  minidom.parseString(response.getBody().getContent()).documentElement
        return pidlist.getElementsByTagName("pid")[0].childNodes[0].nodeValue

    @classmethod
    def normalise_attrname(cls, name):
        return cls.ATTRMAP.get(name, name).encode()

    @classmethod
    def denormalise_attrname(cls, name):
        inv_map = dict((v,k) for k, v in cls.ATTRMAP.items())
        return inv_map.get(name, name)

    @classmethod
    def normalise_profile_attrname(cls, name):
        return cls.PROFMAP.get(name, name).encode()

    @classmethod   
    def denormalise_profile_attrname(cls, name):
        inv_map = dict((v,k) for k, v in cls.PROFMAP.items())
        return inv_map.get(name, name) 
 
