"""
Ocropus plugin.  Because Ocropus offers lots of descrete functionality
this is also the base class of the Tesseract wrapper and the generic
line wrapper.
"""

import os
import re
import logging
import traceback
import UserDict
from ocradmin.ocr.tools import base, check_aborted, \
        set_progress, ExternalToolError
import ocrolib



class OcropusParams(UserDict.DictMixin):
    """
    Convert a dictionary into an object with certain
    default attribites.  It also uses encode() to convert
    Django unicode strings to standard strings with the
    Ocropus python bindings can handle.
    """
    def __init__(self, dct):
        self.lmodel = ""
        self.cmodel = ""
        self.segmenter = "DpSegmenter"
        self.grouper = "StandardGrouper"
        self.psegmenter = "SegmentPageByRAST"
        self.clean = "StandardPreprocessing"
        self.binarizer = "BinarizeBySauvola"
        self.graydeskew = "DeskewGrayPageByRAST"
        self.bindeskew = "DeskewPageByRAST"
        self.binclean0 = "AutoInvert"
        self.binclean1 = "RmHalftone"
        self.binclean2 = "RmBig"
        self.binout = None
        self.segout = None
        self.prebinarized = False

        for key, val in dct.iteritems():
            if isinstance(val, (list, tuple)):
                setattr(self, str(key), [x if isinstance(x, dict) \
                    else self._safe(x) for x in val])
            else:
                setattr(self, str(key), val if isinstance(val, dict) \
                    else self._safe(val))

    def keys(self):
        """Dictionary keys."""
        return self.__dict__.keys()

    @classmethod
    def _safe(cls, param):
        """Convert unicode strings to ocropus-safe values."""
        if isinstance(param, unicode):
            return param.encode()
        else:
            return param

    def __getitem__(self, item):
        """Slice notation."""
        return self.__dict__[item]

    def __repr__(self):
        """Generic representation."""
        return "<%s: %s>" % (self.__class__.__name__, self.__dict__)



class OcropusError(StandardError):
    """
    Ocropus-related exceptions.
    """
    pass



def main_class():
    """
    Exported wrapper.
    """
    return OcropusWrapper


class OcropusWrapper(base.OcrBase):
    """
    Wrapper around OCRopus's basic page-recognition functions so
    that bits and peices can be reused more easily.
    """
    name = "ocropus"
    capabilities = ("line", "binarize", "segment", "trainer")

    def __init__(self, logger=None, abort_func=None, params=None):
        """
        Initialise an OcropusWrapper object.
        """
        self.abort_func = abort_func
        self._linerec = None
        self._lmodel = None
        self._trainbin = None
        self.training = False
        self.logger = logger if logger else self.get_default_logger()
        self.params = OcropusParams(params) if params \
                else OcropusParams({})


    @classmethod
    def write_binary(cls, path, data):
        """
        Write a binary image.
        """
        ocrolib.iulib.write_image_binary(path, ocrolib.numpy2narray(data))


    @classmethod
    def write_packed(cls, path, data):
        """
        Write a packed image.
        """
        ocrolib.iulib.write_image_packed(path, ocrolib.pseg2narray(data))


    def init_converter(self):
        """
        Load the line-recogniser and the lmodel FST objects.
        """
        try:
            self._linerec = ocrolib.RecognizeLine()
            self._linerec.load_native(self.params.cmodel)
            self._lmodel = ocrolib.OcroFST()
            self._lmodel.load(self.params.lmodel)
        except (StandardError, RuntimeError), err:
            raise err
        if self.params.segmenter:
            self.logger.info("Using line segmenter: %s" % self.params.segmenter)
            self._linerec.pset("segmenter", self.params.segmenter)
        if self.params.grouper:
            self.logger.info("Using grouper: %s" % self.params.grouper)
            self._linerec.pset("grouper", self.params.grouper)
        # TODO: Work out how to set parameters on the grouper and segmenter
        # Unsure about how (or if it's possible) to access the segmenter
        # via the LineRec
        #for name, val in self.params.iteritems():
        #    # find the 'long' name for the component with the given short
        #    # name, i.e: binsauvola -> BinarizeBySauvola
        #    cmatch = re.match("%s__(.+)" % self.params.segmenter, name, re.I)
        #    if cmatch:
        #        param = cmatch.groups()[0]
        #        self._linerec.pset(param, val)


    def init_trainer(self):
        """
        Load the cmodel for training.
        """
        try:
            #self._linerec = ocrolib.ocropus.load_linerec(self.params.cmodel)
            self._linerec = ocrolib.RecognizeLine()
            self._linerec.load_native(self.params.cmodel)
        except (StandardError, RuntimeError), err:
            raise err
        self._linerec.startTraining()
        self.training = True


    def finalize_trainer(self):
        """
        Stop training.
        """
        self._linerec.finishTraining()


    @classmethod
    def extract_boxes(cls, page_seg):
        """
        Extract line/paragraph geometry info.
        """
        regions = ocrolib.RegionExtractor()
        out = dict(columns=[], lines=[], paragraphs=[])
        exfuncs = dict(
            columns=regions.setPageColumns,
            lines=regions.setPageLines,
            paragraphs=regions.setPageParagraphs,
        )
        for box, func in exfuncs.iteritems():
            func(page_seg)
            for i in range(1, regions.length()):
                out[box].append([regions.x0(i),
                    regions.y0(i) + (regions.y1(i) - regions.y0(i)),
                    regions.x1(i) - regions.x0(i),
                    regions.y1(i) - regions.y0(i)])
        return out


    def convert(self, filepath, progress_func=None, callback=None, **cbkwargs):
        """
        Convert an image file into text.  A callback can be supplied that
        is evaluated before every individual page line is run.  If it does
        not evaluate to True the function returns early with the page
        results gathered up to that point.  Keyword arguments can also be
        passed to the callback.
        """
        page_bin = self.conditional_preprocess(filepath)
        page_seg = self.get_page_seg(page_bin)
        if self.params.segout:
            self.logger.info("Writing segmentation: %s" % self.params.segout)
            self.write_packed(self.params.segout, page_seg)
        pageheight, pagewidth = page_bin.shape

        self.logger.info("Extracting regions...")
        regions = ocrolib.RegionExtractor()
        regions.setPageLines(page_seg)
        numlines = regions.length()
        self.logger.info("Recognising lines...")
        pagedata = dict(
            page=os.path.basename(filepath),
            lines=[],
            box=[0, 0, pagewidth, pageheight]
        )
        for i in range(1, numlines):
            # test for continuation
            if callback is not None:
                if not callback(**cbkwargs):
                    return pagedata
            set_progress(self.logger, progress_func, i, numlines)
            line = regions.extract(page_bin, i, 1)
            bbox = [regions.x0(i), pageheight - regions.y0(i),
                regions.x1(i) - regions.x0(i), regions.y1(i) - regions.y0(i)]
            text = self.get_transcript(line)
            pagedata["lines"].append({"line": i, "box": bbox, "text" : text })

        # set progress complete
        set_progress(self.logger, progress_func, numlines, numlines)
        return pagedata


    def convert_lines(self, filepath, linedata):
        """
        Convert a single line given a prebinarized file and
        x, y, w, h coords.
        """
        from copy import deepcopy

        page_bin = ocrolib.read_image_gray(filepath)
        pageheight = page_bin.shape[0]
        out = deepcopy(linedata)
        for i in range(len(linedata)):
            coords = linedata[i]["box"]
            iulibcoords = (
                coords[0], pageheight - coords[1], coords[0] + coords[2],
                pageheight - (coords[1] - coords[3]))
            lineimage = ocrolib.iulib.bytearray()
            ocrolib.iulib.extract_subimage(lineimage, 
                    ocrolib.numpy2narray(page_bin), *iulibcoords)
            out[i]["text"] = self.get_transcript(ocrolib.narray2numpy(lineimage))
        return out


    def get_default_logger(self):
        """
        Initialize a default logger to stderr.
        """
        logging.basicConfig(level=logging.DEBUG)
        return logging.getLogger(self.__class__.__name__)


    @check_aborted
    def get_page_binary(self, filepath):
        """
        Convert an on-disk file into an in-memory ocrolib.iulib.bytearray.
        """
        page_gray = ocrolib.read_image_gray(filepath)
        self.logger.info("Binarising image with %s" % self.params.clean)
        preproc = getattr(ocrolib, self.params.clean)()
        return preproc.binarize(page_gray)


    @check_aborted
    def get_page_seg(self, page_bin):
        """
        Segment the binary page into a colour-coded segmented images.
        """
        self.logger.info("Segmenting page with %s" % self.params.psegmenter)
        try:
            segmenter = getattr(ocrolib, self.params.psegmenter)()
            self.logger.info("Loaded %s" % self.params.psegmenter)
        except AttributeError:
            # no native-wrapped component found - try loading a python one
            segmenter = self._load_python_component(self.params.psegmenter)
        for name, val in self.params.iteritems():
            # find the 'long' name for the component with the given short
            # name, i.e: binsauvola -> BinarizeBySauvola
            cmatch = re.match("%s__(.+)" % self.params.psegmenter, name, re.I)
            if cmatch:
                param = cmatch.groups()[0]
                self.logger.info("Setting: %s.%s -> %s" % (
                    self.params.psegmenter, param, val))
                segmenter.pset(param, val)
        return segmenter.segment(page_bin)


    @check_aborted
    def get_transcript(self, line):
        """
        Run line-recognition on an ocrolib.iulib.bytearray images of a
        single line.
        """
        if self._lmodel is None:
            self.init_converter()
        fst = self._linerec.recognizeLine(line)
        # NOTE: This returns the cost - not currently used
        out, _ = ocrolib.beam_search_simple(fst, self._lmodel, 1000)
        return out


    def conditional_preprocess(self, filepath):
        """
        Run preprocessing unless we're told to 
        use a passed-in prebinarized file.
        """
        if self.params.prebinarized:
            page_bin = ocrolib.read_image_gray(filepath)
        else:
            page_bin = self.standard_preprocess(filepath)
            if self.params.binout:
                self.logger.info("Writing binary: %s" % self.params.binout)
                self.write_binary(self.params.binout, page_bin)
        return page_bin


    @check_aborted
    def standard_preprocess(self, filepath):
        """
        Mimic OCRopus's StandardPreprocessing component but
        allow more flexible param setting.  Somehow.
        """
        complookup = self.get_components(
                oftypes=["IBinarize", "ICleanupGray", "ICleanupBinary"])
        pagegray = ocrolib.read_image_gray(filepath)
        self.logger.info("Binarizing with params: %s" % self.params)
        # init components
        binarizer = getattr(ocrolib, self.params.binarizer)()
        graydeskew = None
        if self.params.graydeskew and self.params.graydeskew != "-":
            graydeskew = getattr(ocrolib, self.params.graydeskew)()
        bindeskew = None
        if self.params.bindeskew and self.params.bindeskew != "-":
            bindeskew = getattr(ocrolib, self.params.bindeskew)()
        cleanups = { "grayclean": [], "binclean": [] }
        for cleantype, cleanlist in cleanups.iteritems():
            for i in range(0, 10):
                paramval = self.params.get("%s%s" % (cleantype, i))
                if paramval and paramval != "-":
                    try:
                        cleanlist.append(getattr(ocrolib, paramval)())
                    except IndexError, err:
                        self.logger.error(err.message)

        self._set_component_parameters(complookup, [binarizer,
                bindeskew, graydeskew]
                + cleanups["grayclean"] + cleanups["binclean"])
        self.logger.debug("pagegray: type: %s" % type(pagegray))
        # onwards with cleanup
        pageout = pagegray
        deskewed = False

        if 0: #ocrolib.iulib.contains_only(pageout, 0, 255):
            self.logger.debug("Running BINARY batch clean.")
            pageout = self.batch_clean(cleanups["binclean"], pagegray)
            if bindeskew:
                self.logger.debug("Deskewing with: %s" % self.params.bindeskew)
                pageout = bindeskew.cleanup(pageout)
                deskewed = True
        else:
            self.logger.debug("Running GRAYSCALE batch clean.")
            pageout = self.batch_clean(cleanups["grayclean"], pagegray)
            if graydeskew:
                self.logger.debug("Deskewing with: %s" % self.params.graydeskew)
                pageout = graydeskew.cleanup_gray(pageout)
                deskewed = True

        self.logger.debug("Page out length: %s" % len(pageout))
        try:
            pageout, pagegray = binarizer.binarize(pageout)
        except StandardError, err:
            self.logger.error("Binarizer failed: %s" % err)
        pageout = self.batch_clean(cleanups["binclean"], pageout)
        self.logger.debug("Page out length: %s" % len(pageout))
        if bindeskew and not deskewed:
            try:
                pageout = bindeskew.cleanup(pageout)
            except StandardError, err:
                self.logger.error("Binary deskew failed: %s" % err)
        return pageout


    @check_aborted
    def batch_clean(self, components, pagedata):
        """
        Run a set of cleanup components on the given page data.
        """
        pageout = pagedata
        count = 0
        for component in components:
            try:
                pageout = component.cleanup(pageout)
            except StandardError:
                self.logger.error("clean%s: %s failed:" % (
                    count, component.name()))
            count += 1
        return pageout


    def load_training_binary(self, imagepath):
        """
        Load an image to use for training.
        """
        self._trainbin = ocrolib.read_image_gray(imagepath)


    def train_line(self, bbox, text):
        """
        Train on a line, using the bbox to extract the line
        from the given page.
        """
        if not self.training:
            self.init_trainer()
        # need to invert the bbox for the time being
        # we should really store it the right way
        # round in the first place
        height = self._trainbin.shape[0]
        ibox = (bbox[0], height - bbox[1],
                bbox[0] + bbox[2] + 1,
                (height - bbox[1]) + bbox[3] + 1)
        sub = ocrolib.iulib.bytearray()
        ocrolib.iulib.extract_subimage(sub,
                ocrolib.numpy2narray(self._trainbin), *ibox)

        try:
            self._linerec.addTrainingLine(ocrolib.narray2numpy(sub),
                    unicode(text))
        except StandardError, err:
            traceback.print_exc()
            self.logger.error(
                    "Skipping training line: %s: %s" % (text, err.message))


    def save_new_model(self):
        """
        Finalise training and save model.
        """
        self.logger.info("Attempting to finalise training")
        tries = 5
        while (tries > 0):
            try:
                self.finalize_trainer()
                break
            except StandardError, err:
                self.logger.error("Encounter runtime error: %s" % err.message)
                self.logger.info("Tries left: %d" % tries)
            tries -= 1

        self.logger.info("Saving trained model")
        self._linerec.save_native(self.params.outmodel)


    def _set_component_parameters(self, complookup, components):
        """
        Set parameters from the params object on the
        components passed in *args.
        """
        # set all the parameters on our components
        for component in components:
            if component is None:
                continue
            for name, val in self.params.iteritems():
                # find the 'long' name for the component with the given short
                # name, i.e: binsauvola -> BinarizeBySauvola
                compname = [comp["name"] for comp in complookup.itervalues() \
                        if comp["shortname"] == component.name()][0]
                cmatch = re.match("%s__(.+)" % compname, name, re.I)
                if cmatch is None:
                    continue
                param = cmatch.groups()[0]
                self.logger.info(
                        "Setting: %s.%s -> %s" % (compname, param, val))
                component.pset(param, val)


    @classmethod
    def get_components(cls, oftypes=None, withnames=None):
        """
        Get a datastructure contraining all Ocropus components
        (possibly of a given type) and their default parameters.
        """
        out = {}
        out.update(cls._get_native_components(oftypes, withnames))
        out.update(cls._get_python_components(oftypes, withnames))

        return out


    def _load_python_component(self, name):
        """
        Return the main class for a Python component.
        """
        # FIXME: This triggers an import of everything in components,
        # which is undesirable to say the least
        directory = os.path.join(os.path.dirname(__file__), "components")
        comp = None
        for fname in os.listdir(directory):
            if not fname.endswith(".py"):
                continue
            modname = fname.replace(".py", "", 1)
            try:
                pmod = __import__("%s" % modname, fromlist=[name])
                reload(pmod)
                self.logger.info("Importing: %s" % modname)
                if hasattr(pmod, name):
                    comp = getattr(pmod, name)
                    break
            except ImportError, err:
                self.logger.info("Unable to import module: %s" % err)
        if comp is None:
            raise IndexError("no such component: %s" % name)
        return comp()


    @classmethod
    def _get_native_components(cls, oftypes=None, withnames=None):
        """
        Get a datastructure contraining all Ocropus native components
        (possibly of a given type) and their default parameters.
        """
        out = {}
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
            compdict = {"name": cname, "type": ckind, "params": []}
            # TODO: Fix this heavy-handed exception handling which is
            # liable to mask genuine errors - it's needed because of
            # various inconsistencies in the Python/native component
            # wrappers.
            try:
                comp = getattr(ocrolib, cname)()
                compdict["description"] = comp.description()
                compdict["shortname"] = comp.name()
            except (AttributeError, AssertionError, IndexError):
                continue

            for paramnum in range(0, comp.plength()):
                pname = comp.pname(paramnum)
                compdict["params"].append({
                    "name": pname,
                    "value": comp.pget(pname),
                })
            out[cname] = compdict
        return out


    @classmethod
    def _get_python_components(cls, oftypes=None, withnames=None):
        """
        Get native python components.
        """
        out = {}
        directory = os.path.join(os.path.dirname(__file__), "components")
        for fname in os.listdir(directory):
            if not fname.endswith(".py"):
                continue
            modname = fname.replace(".py", "", 1)
            pmod = __import__("%s" % modname, fromlist=["main_class"])
            if not hasattr(pmod, "main_class"):
                continue
            ctype = pmod.main_class()
            ckind = ctype.__base__.__name__

            # note: the loading function in ocropy/components.py expects
            # python components to have a module-qualified name, i.e:
            # mymodule.MyComponent.
            cname = ctype.__name__
            if oftypes and not \
                    ckind.lower() in [c.lower() for c in oftypes]:
                continue
            if withnames and not \
                    cname.lower() in [n.lower() for n in withnames]:
                continue

            comp = ctype()
            # FIXME: Extreme dodginess getting the interface type,
            # very fragile
            compdict = dict(
                name=cname,
                type=ckind,
                params=[],
                shortname=comp.name(),
                description=comp.description()
            )
            for paramnum in range(0, comp.plength()):
                pname = comp.pname(paramnum)
                compdict["params"].append({
                    "name": pname,
                    "value": comp.pget(pname),
                })
            out[cname] = compdict
        return out




