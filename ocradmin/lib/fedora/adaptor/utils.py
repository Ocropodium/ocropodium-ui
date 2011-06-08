# fedora adaptor

import re

from fcrepo.http.restapi import FCRepoRestAPI

from xml.dom import minidom
import fcobject

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

def add_ns(tag):
     return "%s%s" % (NS, tag) 

def strip_ns(tag, ns=None):
    if ns is None:
        ns = NS
    return tag.replace(ns, "", 1)


class FedoraException(Exception):
    pass


class FedoraAdaptorException(Exception):
    pass

