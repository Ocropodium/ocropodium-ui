"""
Image transformation nodes based on the Python Image Library (PIL).
"""

from __future__ import absolute_import

import os
from nodetree import node
import numpy
from PIL import Image

from . import generic
from .. import stages


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


class RGBFileInNode(generic.ImageGeneratorNode, generic.BinaryPngWriterMixin):
    """Read a file with PIL."""
    stage = stages.INPUT
    intypes = [numpy.ndarray]
    outtype = numpy.ndarray
    _parameters = [dict(name="path", value="", type="filepath")]

    def _eval(self):
        path = self._params.get("path")
        if not os.path.exists(path):
            return self.null_data()
        return numpy.asarray(Image.open(path))

    @classmethod
    def reader(cls, path):
        return numpy.asarray(Image.open(path))

    @classmethod
    def writer(cls, path, data):
        pil = Image.fromarray(data)
        pil.save(path, "PNG")
        return path


class PilScaleNode(node.Node, generic.BinaryPngWriterMixin):
    """Scale an image with PIL"""
    stage = stages.FILTER_GRAY
    intypes = [numpy.ndarray]
    outtype = numpy.ndarray
    _parameters = [
        dict(name="scale", value=1.0),
        dict(name="filter", value="NEAREST", choices=[
            "NEAREST", "BILINEAR", "BICUBIC", "ANTIALIAS"    
        ]),
    ]

    def _validate(self):
        super(PilScaleNode, self)._validate()
        if not self._params.get("scale"):
            raise node.ValidationError(self, "'scale' is not set")
        try:
            num = float(self._params.get("scale"))
        except ValueError:
            raise node.ValidationError(self, "'float' must be a float")
    
    def _eval(self):
        """Scale image."""
        scale = float(self._params.get("scale"))
        pil = Image.fromarray(self.get_input_data(0))
        dims = [int(dim * scale) for dim in pil.size]
        scaled = pil.resize(tuple(dims), getattr(Image, self._params.get("filter")))
        return numpy.asarray(scaled.convert("L"))


class PilCropNode(node.Node, generic.BinaryPngWriterMixin):
    """Crop an image with PIL."""
    stage = stages.FILTER_GRAY
    intypes = [numpy.ndarray]
    outtype = numpy.ndarray
    _parameters = [
        dict(name="x0", value=-1),
        dict(name="y0", value=-1),
        dict(name="x1", value=-1),
        dict(name="y1", value=-1),
    ]

    def _eval(self):
        """
        Crop an image, using IULIB.  If any of
        the parameters are -1 or less, use the
        outer dimensions.
        """
        input = self.get_input_data(0)
        x0, y0 = 0, 0
        y1, x1 = input.shape
        try:
            x0 = int(self._params.get("x0", -1))
            if x0 < 0: x0 = 0
        except TypeError: pass
        try:
            y0 = int(self._params.get("y0", -1))
            if y0 < 0: y0 = 0
        except TypeError: pass
        try:
            x1 = int(self._params.get("x1", -1))
            if x1 < 0: x1 = input.shape[1]
        except TypeError: pass
        try:
            y1 = int(self._params.get("y1", -1))
            if y1 < 0: y1 = input.shape[0]
        except TypeError: pass
        pil = Image.fromarray(input)
        p2 = pil.crop((x0, y0, x1, y1))
        self.logger.debug("Pil crop: %s", p2)
        n = numpy.asarray(p2.convert("L"))
        self.logger.debug("Numpy: %s", n)
        return n


class RGB2GrayNode(node.Node, generic.GrayPngWriterMixin):    
    """
    Convert (roughly) between a color image and BW.
    """
    stage = stages.FILTER_GRAY
    intypes = [numpy.ndarray]
    outtype = numpy.ndarray
    _parameters = []

    def _eval(self):
        pil = Image.fromarray(self.eval_input(0))        
        return numpy.asarray(pil.convert("L"))


class PilTestNode(node.Node):
    """
    Test PIL OPs.
    """
    stage = stages.FILTER_BINARY

    def _validate(self):
        super(PilTestNode, self)._validate()

    def _eval(self):
        """
        No-op, for now.
        """
        return self.get_input_data(0)

