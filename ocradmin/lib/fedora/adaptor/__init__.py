
import fcobject
reload(fcobject)
import utils
reload(utils)
import xml.etree.cElementTree as elementtree
from cStringIO import StringIO


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



class FedoraAdaptor(object):
    def __init__(self, *args, **kwargs):
        self._params = {}
        self._params.update(utils.DEFAULTS)
        self._handler = utils.FCRepoRestAPI(**self._params)


    def query(self, *args, **kwargs):
        objects = []
        response = self._handler.findObjects(**query_args(kwargs))
        parsetree = elementtree.parse(StringIO(response.getBody().getContent()))
        for results in parsetree.getroot().findall(utils.add_ns("resultList")):
            for ele in results.findall(utils.add_ns("objectFields")):
                objects.append(fcobject.FedoraObject.from_xml(ele, **self._params))
        return objects

    def new_object(self, *args, **kwargs):
        response = self._handler.getNextPID(**query_args(kwargs))
        parsetree = elementtree.parse(StringIO(response.getBody().getContent()))
        try:
            nextpid = parsetree.findall("pid")[0].text
            return fcobject.FedoraObject.from_pid(self._handler, nextpid)
        except IndexError, e:
            raise utils.FedoraException("Unable to retrieve next pid for object.  Last response body: %s" %
                    response.getBody().getContent())

                
    def __getattr__(self, attrname):
        try:
            return self.__dict__[attrname]
        except KeyError:
            return getattr(self._handler, attrname)



