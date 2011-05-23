"""
Ocropus OCR processing stages.
"""

import plugins
import stage
reload(stage)

import ocrolib

class OcropusStage(stage.Stage):
    """
    Wrapper around Ocropus component interface.
    """
    def __init__(self, comp, **kwargs):
        """
        Initialise with the ocropus component.
        """
        super(OcropusStage, self).__init__(**kwargs)
        self._comp = comp
        self._params = kwargs.get("params", {})

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


class OcropusBinarizeStage(OcropusStage):
    """
    Binarize an image with an Ocropus component.
    """
    def _eval(self, input):
        """
        Perform binarization on an image.
        
        input: a grayscale image.
        return: a binary image.
        """
        return self._comp.binarize(input)[0]


class OcropusPageSegmentStage(OcropusStage):
    """
    Segment an image using Ocropus.
    """
    def _eval(self, input):
        """
        Segment a binary image.

        input: a binary image.
        return: a dictionary of box types:
            lines
            paragraphs
            columns
            images
        """
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

class OcropusGrayscaleFilterStage(OcropusStage):
    """
    Filter a binary image.
    """
    def _eval(self, input):
        return self._comp.cleanup_gray(input)


class OcropusBinaryFilterStage(OcropusStage):
    """
    Filter a binary image.
    """
    def _eval(self, input):
        return self._comp.cleanup(input)


class OcropusRecognizerStage(stage.Stage):
    """
    Recognize an image using Ocropus.
    """
    _name = "OcropusNativeRecognizer"
    _desc = "Ocropus Native Text Recognizer"

    def __init__(self, **kwargs):
        super(OcropusRecognizerStage, self).__init__(**kwargs)
        self._params = kwargs        

    def _eval(self, input):
        """
        Recognize page text.

        input: tuple of binary, input boxes
        return: page data
        """
        binary, boxes = input
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
    def get_stage(self, name):
        """
        Get a stage by the given name.
        """
        if name == "NativeRecognizer":
            return OcropusRecognizerStage()
        if not hasattr(ocrolib, name):
            raise NoSuchStageException(name)
        comp = getattr(ocrolib, name)()
        if comp.c_interface == "IBinarize":
            return OcropusBinarizeStage(comp)
        elif comp.c_interface == "ISegmentPage":
            return OcropusPageSegmentStage(comp)
        elif comp.c_interface == "ICleanupGray":
            return OcropusGrayscaleFilterStage(comp)
        elif comp.c_interface == "ICleanupBinary":
            return OcropusBinaryFilterStage(comp)
        else:
            raise UnknownOcropusStageType(name)

    @classmethod
    def get_stages(self, *types):
        """
        Get stages of the given type.
        """
        pass




