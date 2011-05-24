"""
Ocropus OCR processing nodes.
"""

import plugins
import node
reload(node)

import ocrolib


class OcropusFileInNode(node.Node):
    """
    A node that takes a file and returns a numpy object.
    """
    _name = "FileIn"
    _description = "File Input Node"
    _arity = 0
    _stage = "filein"

    def _eval(self):
        if not self._params.get("path"):
            raise node.UnsetParameterError("path")
        ba = ocrolib.iulib.bytearray()
        ocrolib.iulib.read_image_binary(ba, self._params.get("path"))
        return ocrolib.narray2numpy(ba)
        
    

class OcropusNode(node.Node):
    """
    Wrapper around Ocropus component interface.
    """
    def __init__(self, comp, **kwargs):
        """
        Initialise with the ocropus component.
        """
        super(OcropusNode, self).__init__(**kwargs)
        self._comp = comp
        self._name = comp.__class__.__name__
        self._params = kwargs.get("params", {})
        _stage = None

    def _set_p(self, p, v):
        """
        Set a component param.
        """
        self._comp.pset(p, v)

    def name(self):
        """
        Get the inner component name.
        """
        return self._comp.__class__.__name__

    def description(self):
        """
        Get the inner component description.
        """
        return self._comp.description()


class OcropusBinarizeNode(OcropusNode):
    """
    Binarize an image with an Ocropus component.
    """
    _arity = 1
    _stage = "binarize"
    def _eval(self):
        """
        Perform binarization on an image.
        
        input: a grayscale image.
        return: a binary image.
        """
        input = self.eval_input(0)
        return self._comp.binarize(input)[0]


class OcropusPageSegmentNode(OcropusNode):
    """
    Segment an image using Ocropus.
    """
    _arity = 1
    _stage = "page_segment"
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
        input = self.eval_input(0)
        page_seg = self._comp.segment(input)
        regions = ocrolib.RegionExtractor()
        out = dict(columns=[], lines=[], paragraphs=[])
        exfuncs = dict(lines=regions.setPageLines,
                paragraphs=regions.setPageParagraphs)
        for box, func in exfuncs.iteritems():
            func(page_seg)
            for i in range(1, regions.length()):
                out[box].append([regions.x0(i),
                    regions.y0(i) + (regions.y1(i) - regions.y0(i)),
                    regions.x1(i) - regions.x0(i),
                    regions.y1(i) - regions.y0(i)])
        return out

class OcropusGrayscaleFilterNode(OcropusNode):
    """
    Filter a binary image.
    """
    _arity = 1
    _stage = "filter"
    def _eval(self):
        input = self.eval_input(0)
        return self._comp.cleanup_gray(input)


class OcropusBinaryFilterNode(OcropusNode):
    """
    Filter a binary image.
    """
    _arity = 1
    _stage = "filter"
    def _eval(self):
        input = self.eval_input(0)
        return self._comp.cleanup(input)


class OcropusRecognizerNode(node.Node):
    """
    Recognize an image using Ocropus.
    """
    _name = "OcropusNativeRecognizer"
    _desc = "Ocropus Native Text Recognizer"
    _stage = "recognize"
    _arity = 2

    def __init__(self, **kwargs):
        super(OcropusRecognizerNode, self).__init__(**kwargs)
        self._params = kwargs        

    def _eval(self):
        """
        Recognize page text.

        input: tuple of binary, input boxes
        return: page data
        """
        binary = self.eval_input(0)
        boxes = self.eval_input(1)
        pageheight, pagewidth = binary.shape
        iulibbin = ocrolib.numpy2narray(binary)
        out = dict(
                lines=[],
                box=[0, 0, pagewidth, pageheight],
        )
        for i in range(len(boxes.get("lines", []))):
            coords = boxes.get("lines")[i]
            iulibcoords = (
                coords[0], pageheight - coords[1], coords[0] + coords[2],
                pageheight - (coords[1] - coords[3]))
            lineimage = ocrolib.iulib.bytearray()
            ocrolib.iulib.extract_subimage(lineimage, iulibbin, *iulibcoords)
            out["lines"].append(dict(
                    box=coords,
                    text=self.get_transcript(ocrolib.narray2numpy(lineimage)),
            ))
        return out

    def init_converter(self):
        """
        Load the line-recogniser and the lmodel FST objects.
        """
        try:
            self._linerec = ocrolib.RecognizeLine()
            cmodpath = plugins.lookup_model_file(self._params["character_model"])
            self.logger.info("Loading file: %s" % cmodpath)
            self._linerec.load_native(cmodpath)
            self._lmodel = ocrolib.OcroFST()
            lmodpath = plugins.lookup_model_file(self._params["language_model"])
            self.logger.info("Loading file: %s" % lmodpath)
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



class OcropusModule(object):
    """
    Interface to ocropus.
    """
    
    @classmethod
    def get_node(self, name):
        """
        Get a node by the given name.
        """
        if name == "NativeRecognizer":
            return OcropusRecognizerNode()
        elif name == "FileIn":
            return OcropusFileInNode()
        if not hasattr(ocrolib, name):
            raise plugins.NoSuchNodeException(name)
        comp = getattr(ocrolib, name)()
        if comp.c_interface == "IBinarize":
            return OcropusBinarizeNode(comp)
        elif comp.c_interface == "ISegmentPage":
            return OcropusPageSegmentNode(comp)
        elif comp.c_interface == "ICleanupGray":
            return OcropusGrayscaleFilterNode(comp)
        elif comp.c_interface == "ICleanupBinary":
            return OcropusBinaryFilterNode(comp)
        else:
            raise UnknownOcropusNodeType(name)

    @classmethod
    def get_nodes(self, *types):
        """
        Get nodes of the given type.
        """
        pass




