"""
Image transformation nodes based on the Python Image Library (PIL).
"""

import node
import stages
import numpy
from PIL import Image

def image2array(im):
    if im.mode not in ("L", "F"):
        raise ValueError, "can only convert single-layer images"
    if im.mode == "L":
        a = numpy.fromstring(im.tostring(), numpy.uint8)
    else:
        a = numpy.fromstring(im.tostring(), numpy.float32)
    a.shape = im.size[1], im.size[0]
    return a

def array2image(a):
    if a.dtype == numpy.uint8:
        mode = "L"
    elif a.dtype == numpy.float32:
        mode = "F"
    else:
        raise ValueError, "unsupported image mode"
    return Image.fromstring(mode, (a.shape[1], a.shape[0]), a.tostring())


class PilTestNode(node.Node):
    """
    Test PIL OPs.
    """
    arity = 1
    stage = stages.FILTER_BINARY
    name = "Pil::Test"

    def validate(self):
        super(PilTestNode, self).validate()

    def _eval(self):
        """
        No-op, for now.
        """
        return self.eval_input(0)

