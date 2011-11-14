"""
Nodes for interoperating with Fedora Commons.
"""

import ocrolib
from nodetree import node, exceptions
from cStringIO import StringIO

from . import base
from .. import stages, utils

from eulfedora.server import Repository
from eulfedora.util import RequestFailed
from PIL import Image


class FedoraImageFilein(base.ImageGeneratorNode,
            base.GrayPngWriterMixin):
    stage = stages.INPUT
    intypes = []
    outtype = ocrolib.numpy.ndarray
    parameters = [
            dict(name="url", value="http://localhost:8080/fedora/"),
            dict(name="username", value="fedoraAdmin"),
            dict(name="password", value="fedora"),
            dict(name="pid", value=""),
            dict(name="dsid", value=""),
    ]

    def validate(self):
        super(FedoraImageFilein, self).validate()
        missing = []
        for pname in [p["name"] for p in self.parameters]:
            if not self._params.get(pname, "").strip():
                missing.append(pname)
        if missing:
            raise exceptions.ValidationError(
                    "Missing parameter(s): %s" % ", ".join(missing), self)

    def process(self):
        repo = Repository(self._params.get("url"), self._params.get("username"),
                self._params.get("password"))
        # Fixme... this is not the correct way of downloading a datastream!
        try:
            iodata = StringIO(repo.api.getDatastreamDissemination(
                    self._params.get("pid"), self._params.get("dsid"))[0])
            pil = Image.open(iodata)
        except IOError:
            raise exceptions.NodeError(
                    "Error reading datastream contents as an image.", self)
        except RequestFailed:
            raise exceptions.NodeError(
                    "Error communicating with Fedora Repository: 404", self)
        return ocrolib.numpy.asarray(pil)

