
from __future__ import absolute_import

from nodetree import node, writable_node
from .generic import GrayPngWriterMixin
from .. import stages
import numpy


class Rotate90(node.Node, GrayPngWriterMixin):
    """
    Rotate a Numpy image num*90 degrees counter-clockwise.
    """
    stage = stages.FILTER_BINARY
    intypes = [numpy.ndarray]
    outtype = numpy.ndarray
    _parameters = [{
        "name": "num",
        "value": 1,
    }]
                    
    def _validate(self):
        super(Rotate90, self)._validate()
        if not self._params.get("num"):
            raise node.ValidationError(self, "'num' is not set")
        try:
            num = int(self._params.get("num"))
        except ValueError:
            raise node.ValidationError(self, "'num' must be an integer")

    def _eval(self):
        image = self.get_input_data(0)
        return numpy.rot90(image, int(self._params.get("num", 1)))


class Rotate90Gray(Rotate90):
    """
    Grayscale version of above.
    """
    stage = stages.FILTER_GRAY


