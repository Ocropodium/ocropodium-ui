"""
Image transformation nodes based on the Python Image Library (PIL).
"""

import os
from nodetree import node, manager
from ocradmin.plugins import stages, generic_nodes
import numpy
from PIL import Image

NAME = "Pil"

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


class PilFileInNode(generic_nodes.ImageGeneratorNode):
    """Read a file with PIL."""
    stage = stages.INPUT
    name = "Pil::FileIn"
    description = "PIL File Input node"
    _parameters = [dict(name="path", value="", type="filepath")]

    def _eval(self):
        path = self._params.get("path")
        if not os.path.exists(path):
            return self.null_data()
        return numpy.asarray(Image.open(path))



class PilTestNode(node.Node):
    """
    Test PIL OPs.
    """
    arity = 1
    stage = stages.FILTER_BINARY
    name = "Pil::Test"

    def _validate(self):
        super(PilTestNode, self)._validate()

    def _eval(self):
        """
        No-op, for now.
        """
        return self.get_input_data(0)


class Manager(manager.StandardManager):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        if name == "FileIn":            
            return PilFileInNode(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())


if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n




