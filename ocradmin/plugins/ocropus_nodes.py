"""
Ocropus OCR processing nodes.
"""

import os
import sys
import json

from ocradmin import plugins
from nodetree import node, writable_node, manager

import ocrolib
from ocradmin.ocrmodels.models import OcrModel

from ocradmin.plugins import stages, generic_nodes

NAME = "Ocropus"

class UnknownOcropusNodeType(Exception):
    pass


class OcropusNodeError(node.NodeError):
    pass


def makesafe(val):
    if isinstance(val, unicode):
        return val.encode()
    return val



class OcropusFileInNode(generic_nodes.ImageGeneratorNode,
            generic_nodes.FileNode, generic_nodes.GrayPngWriterMixin):
    """
    A node that takes a file and returns a numpy object.
    """
    name = "Ocropus::GrayFileIn"
    description = "Image file input node"
    stage = stages.INPUT
    arity = 0
    intypes = []
    outtype = ocrolib.numpy.ndarray

    def _eval(self):
        if not os.path.exists(self._params.get("path", "")):
            return self.null_data()
        return ocrolib.read_image_gray(makesafe(self._params.get("path")))
        

class OcropusCropNode(node.Node, generic_nodes.BinaryPngWriterMixin):
    """
    Crop a PNG input.
    """
    arity = 1
    description = "Crop a binary image."
    name = "Ocropus::Crop"
    stage = stages.FILTER_BINARY
    intypes = [ocrolib.numpy.ndarray]
    outtype = ocrolib.numpy.ndarray
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
        # flip the coord system from HOCR to internal
        iy0 = input.shape[1] - y1
        iy1 = input.shape[1] - y0i
        iulibbin = ocrolib.numpy2narray(input)
        out = ocrolib.iulib.bytearray()
        ocrolib.iulib.extract_subimage(out, iulibbin, x0, iy0, x1, iy1)
        return ocrolib.narray2numpy(out)            


class OcropusBase(node.Node):
    """
    Wrapper around Ocropus component interface.
    """
    _comp = None
    name = "base"

    def __init__(self, **kwargs):
        """
        Initialise with the ocropus component.  
        """
        super(OcropusBase, self).__init__(**kwargs)

    def _set_p(self, p, v):
        """
        Set a component param.
        """
        self._comp.pset(makesafe(p), makesafe(v))

    def __getstate__(self):
        """
        Used when pickled.  Here we simply ignore the
        internal component, which itself contains an
        unpickleable C++ type.
        """
        return super(OcropusBase, self).__dict__

    def _validate(self):
        """
        Check state of the inputs.
        """
        self.logger.debug("%s: validating...", self)
        super(OcropusBase, self)._validate()
        for i in range(len(self._inputs)):
            if self._inputs[i] is None:
                raise node.ValidationError(self, "missing input '%d'" % i)

    @classmethod
    def parameters(cls):
        """
        Get parameters from an Ocropus Node.
        """
        p = []
        for i in range(cls._comp.plength()):
            n = cls._comp.pname(i)
            p.append(dict(
                name=n,
                value=cls._comp.pget(n),
            ))
        return p            


class OcropusBinarizeBase(OcropusBase, generic_nodes.BinaryPngWriterMixin):
    """
    Binarize an image with an Ocropus component.
    """
    arity = 1
    stage = stages.BINARIZE
    intypes = [ocrolib.numpy.ndarray]
    outtype = ocrolib.numpy.ndarray

    def _eval(self):
        """
        Perform binarization on an image.
        
        input: a grayscale image.
        return: a binary image.
        """
        # NB. The Ocropus binarize function
        # returns a tuple: (binary, gray)
        # we ignore the latter.
        input = self.get_input_data(0)
        try:
            out = self._comp.binarize(input, type="B")[0]
        except (IndexError, TypeError, ValueError), err:
            raise OcropusNodeError(self, err.message)
        return out


class OcropusSegmentPageBase(OcropusBase, generic_nodes.JSONWriterMixin):
    """
    Segment an image using Ocropus.
    """
    arity = 1
    stage = stages.PAGE_SEGMENT
    intypes = [ocrolib.numpy.ndarray]
    outtype = dict

    def null_data(self):
        """
        Return an empty list when ignored.
        """
        return dict(columns=[], lines=[], paragraphs=[])

    def _eval(self):
        """
        Segment a binary image.

        input: a binary image.
        return: a dictionary of box types:
            lines
            paragraphs
            columns
            images
        """
        input = self.get_input_data(0)
        out = dict(bbox=[0, 0, input.shape[1], input.shape[0]],
                columns=[], lines=[], paragraphs=[])
        try:
            page_seg = self._comp.segment(input)
        except (IndexError, TypeError, ValueError), err:
            raise OcropusNodeError(self, err.message)
        regions = ocrolib.RegionExtractor()
        exfuncs = dict(lines=regions.setPageLines,
                paragraphs=regions.setPageParagraphs)
        # NB: These coordinates are relative to the TOP of the page
        # for some reason
        for box, func in exfuncs.iteritems():
            func(page_seg)
            for i in range(1, regions.length()):
                out[box].append((
                    regions.x0(i), regions.y0(i), regions.x1(i), regions.y1(i)))
        return out


class OcropusGrayscaleFilterBase(OcropusBase, generic_nodes.GrayPngWriterMixin):
    """
    Filter a binary image.
    """
    arity = 1
    stage = stages.FILTER_GRAY
    intypes = [ocrolib.numpy.ndarray]
    outtype = ocrolib.numpy.ndarray

    def _eval(self):
        input = self.get_input_data(0)
        try:
            out = self._comp.cleanup_gray(input, type="B")
        except (IndexError, TypeError, ValueError), err:
            raise OcropusNodeError(self, err.message)
        return out



class OcropusBinaryFilterBase(OcropusBase, generic_nodes.BinaryPngWriterMixin):
    """
    Filter a binary image.
    """
    arity = 1
    stage = stages.FILTER_BINARY
    intypes = [ocrolib.numpy.ndarray]
    outtype = ocrolib.numpy.ndarray

    def _eval(self):
        input = self.get_input_data(0)
        try:
            out = self._comp.cleanup(input, type="B")
        except (IndexError, TypeError, ValueError), err:
            raise OcropusNodeError(self, err.message)
        return out


class OcropusRecognizerNode(generic_nodes.LineRecognizerNode):
    """
    Recognize an image using Ocropus.
    """
    name = "Ocropus::OcropusRecognizer"
    description = "Ocropus Native Text Recognizer"
    _parameters = [
        dict(
            name="character_model",
            value="Ocropus Default Char",
            choices=[m.name for m in \
                    OcrModel.objects.filter(app="ocropus", type="char")],
        ), dict(
            name="language_model",
            value="Ocropus Default Lang",
            choices=[m.name for m in \
                    OcrModel.objects.filter(app="ocropus", type="lang")],
        )
    ]

    def _validate(self):
        """
        Check we're in a good state.
        """
        super(OcropusRecognizerNode, self)._validate()
        if self._params.get("character_model", "").strip() == "":
            raise node.ValidationError(self, "no character model given.")
        if self._params.get("language_model", "").strip() == "":
            raise node.ValidationError(self, "no language model given: %s" % self._params)


    def init_converter(self):
        """
        Load the line-recogniser and the lmodel FST objects.
        """
        try:
            self._linerec = ocrolib.RecognizeLine()
            cmodpath = plugins.lookup_model_file(self._params["character_model"])
            self.logger.debug("Loading char mod file: %s" % cmodpath)
            self._linerec.load_native(cmodpath)
            self._lmodel = ocrolib.OcroFST()
            lmodpath = plugins.lookup_model_file(self._params["language_model"])
            self.logger.debug("Loading lang mod file: %s" % lmodpath)
            self._lmodel.load(lmodpath)
        except (StandardError, RuntimeError):
            raise

    @plugins.check_aborted
    def get_transcript(self, line):        
        """
        Run line-recognition on an ocrolib.iulib.bytearray images of a
        single line.
        """        
        if not hasattr(self, "_lmodel"):
            self.init_converter()
        fst = self._linerec.recognizeLine(line)
        # NOTE: This returns the cost - not currently used
        out, _ = ocrolib.beam_search_simple(fst, self._lmodel, 1000)
        return out



class Manager(manager.StandardManager):
    """
    Interface to ocropus.
    """
    _use_types = (
        "IBinarize",
        "ISegmentPage",
        "ICleanupGray",
        "ICleanupBinary",
    )
    _ignored = (
        "StandardPreprocessing",
    )

    @classmethod
    def get_components(cls, oftypes=None, withnames=None, exclude=None):
        """
        Get a datastructure contraining all Ocropus components
        (possibly of a given type) and their default parameters.
        """
        return cls._get_native_components(oftypes, withnames, exclude=exclude)
    
    
    @classmethod
    def get_node(cls, name, **kwargs):
        """
        Get a node by the given name.
        """
        klass = cls.get_node_class(name)
        return klass(**kwargs)

    @classmethod
    def get_node_class(cls, name, comps=None):
        """
        Get a node class for the given name.
        """
        # if we get a qualified name like
        # Ocropus::Recognizer, remove the
        # path, since we ASSume that we're
        # looking in the right module
        if name.find("::") != -1:
            name = name.split("::")[-1]

        if name == "OcropusRecognizer":
            return OcropusRecognizerNode
        elif name == "GrayFileIn":
            return OcropusFileInNode
        elif name == "FileOut":
            return OcropusFileOutNode
        elif name == "Switch":
            return SwitchNode
        elif name == "Crop":
            return OcropusCropNode
        # FIXME: This clearly sucks
        comp = None
        if comps is not None:
            for c in comps:
                if name == c.__class__.__name__:
                    comp = c
                    break
        else:
            comp = getattr(ocrolib, name)()
        if node is None:
            raise plugins.NoSuchNodeException(name)

        base = OcropusBase
        if comp.interface() == "IBinarize":
            base = OcropusBinarizeBase
        elif comp.interface() == "ISegmentPage":
            base = OcropusSegmentPageBase
        elif comp.interface() == "ICleanupGray":
            base = OcropusGrayscaleFilterBase
        elif comp.interface() == "ICleanupBinary":
            base = OcropusBinaryFilterBase
        else:
            raise UnknownOcropusNodeType("%s: '%s'" % (name, comp.interface()))
        # this is a bit weird
        # create a new class with the name '<OcropusComponentName>Node'
        # and the component as the inner _comp attribute
        return type("%sNode" % comp.__class__.__name__,
                    (base,), 
                    dict(_comp=comp, description=comp.description(),
                        name="Ocropus::%s" % comp.__class__.__name__))

    @classmethod
    def get_nodes(cls, *oftypes, **kwargs):
        """
        Get nodes of the given type.
        """
        kwargs.update(dict(globals=globals()))
        nodes = super(Manager, cls).get_nodes(*oftypes, **kwargs)
        rawcomps = cls.get_components(oftypes=cls._use_types, exclude=cls._ignored)
        for comp in rawcomps:
            n = cls.get_node_class(comp.__class__.__name__, comps=rawcomps)
            if len(oftypes) > 0:
                if n.stage not in oftypes:
                    continue
            nodes.append(n)
        return nodes


    @classmethod
    def _get_native_components(cls, oftypes=None, withnames=None, exclude=None):
        """
        Get a datastructure contraining all Ocropus native components
        (possibly of a given type) and their default parameters.
        """
        out = []
        clist = ocrolib.ComponentList()
        for i in range(clist.length()):
            ckind = clist.kind(i)
            if oftypes and not \
                    ckind.lower() in [c.lower() for c in oftypes]:
                continue
            cname = clist.name(i)
            if withnames and not \
                    cname.lower() in [n.lower() for n in withnames]:
                continue
            if exclude and cname.lower() in [n.lower() for n in exclude]:
                continue
            compdict = dict(name=cname, type=ckind, parameters=[])
            # TODO: Fix this heavy-handed exception handling which is
            # liable to mask genuine errors - it's needed because of
            # various inconsistencies in the Python/native component
            # wrappers.
            try:
                comp = getattr(ocrolib, cname)()
            except (AttributeError, AssertionError, IndexError):
                continue
            out.append(comp)
        return out

