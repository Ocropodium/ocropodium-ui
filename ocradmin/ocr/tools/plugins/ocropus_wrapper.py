"""
Ocropus plugin.  Because Ocropus offers lots of descrete functionality
this is also the base class of the Tesseract wrapper and the generic
line wrapper.
"""

import os
import re
import sys
import logging
import traceback
import UserDict
from ocradmin.ocr.tools import base, check_aborted, set_progress, ExternalToolError
import iulib
import ocropus
from ocrolib import components



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
        self.graydeskew = "DeskewPageByRAST"
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

    def _safe(self, param):
        """Convert unicode strings to safe values."""
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
        self.training = False
        self.logger = logger if logger else self.get_default_logger()
        self.params = OcropusParams(params) if params \
                else OcropusParams({})


    @classmethod
    def write_binary(cls, path, data):
        """
        Write a binary image.
        """
        iulib.write_image_binary(path, data)


    @classmethod
    def write_packed(cls, path, data):
        """
        Write a packed image.
        """
        iulib.write_image_packed(path, data)


    def init_converter(self):
        """
        Load the line-recogniser and the lmodel FST objects.
        """
        try:
            self._linerec = ocropus.load_linerec(self.params.cmodel)
            self._lmodel = ocropus.make_OcroFST()
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
        #        self.logger.info("Setting: %s.%s -> %s" % (self.params.psegmenter, param, val))
        #        self._linerec.pset(param, val)


    def init_trainer(self):
        """
        Load the cmodel for training.
        """
        from ocropy import linerec
        try:
            #self._linerec = ocropus.load_linerec(self.params.cmodel)
            self._linerec = linerec.LineRecognizer()
            self._linerec.load(self.params.cmodel)
        except (StandardError, RuntimeError), err:
            raise err
        self._linerec.startTraining()        
        self.training = True


    def finalize_trainer(self):
        """
        Stop training.
        """
        self._linerec.finishTraining()


    def save_trained_model(self):
        """
        Save the results of training.
        """
        #self._linerec.save(self.params.outmodel)
        ocropus.save_component(self.params.outmodel, self._linerec.cmodel)
        

    def extract_boxes(self, page_seg):
        """
        Extract line/paragraph geometry info.
        """
        regions = ocropus.RegionExtractor()
        out = dict(columns=[], lines=[], paragraphs=[])
        exfuncs = dict(
            columns=regions.setPageColumns,
            lines=regions.setPageLines,
            paragraphs=regions.setPageParagraphs,
        )
        pageheight = page_seg.dim(1)

        for box, func in exfuncs.iteritems():
            func(page_seg)
            for i in range(1, regions.length()):
                out[box].append([regions.x0(i), pageheight - regions.y0(i),
                    regions.x1(i) - regions.x0(i), regions.y1(i) - regions.y0(i)])
        return out            


    def convert(self, filepath, progress_func=None, callback=None, **cbkwargs):
        """
        Convert an image file into text.  A callback can be supplied that
        is evaluated before every individual page line is run.  If it does
        not evaluate to True the function returns early with the page 
        results gathered up to that point.  Keyword arguments can also be
        passed to the callback.
        """
        if not self.params.prebinarized:
            _, page_bin = self.standard_preprocess(filepath)
            if self.params.binout:
                self.logger.info("Writing binary: %s" % self.params.binout)
                self.write_binary(self.params.binout, page_bin)
        else:
            page_bin = iulib.bytearray()
            iulib.read_image_binary(page_bin, filepath)
        page_seg = self.get_page_seg(page_bin)
        if self.params.segout:
            self.logger.info("Writing segmentation: %s" % self.params.segout)
            self.write_packed(self.params.segout, page_seg)
        pagewidth = page_seg.dim(0)
        pageheight = page_seg.dim(1)
        
        self.logger.info("Extracting regions...")
        regions = ocropus.RegionExtractor()
        regions.setPageLines(page_seg)
        numlines = regions.length()
        self.logger.info("Recognising lines...")
        pagedata = { 
            "page" : os.path.basename(filepath) ,
            "lines": [],
            "box": [0, 0, pagewidth, pageheight]
        }
        for i in range(1, numlines):
            # test for continuation
            if callback is not None:
                if not callback(**cbkwargs):
                    return pagedata
            set_progress(self.logger, progress_func, i, numlines)
            line = iulib.bytearray()
            regions.extract(line, page_bin, i, 1)        
            bbox = [regions.x0(i), pageheight - regions.y0(i),
                regions.x1(i) - regions.x0(i), regions.y1(i) - regions.y0(i)]
            try:
                text = self.get_transcript(line)
            except ExternalToolError, err:
                raise err
            #except StandardError, err:
            #    raise err
            #    self.logger.error("Caught conversion error: %s" % err.message)
            #    text = ""
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

        page_bin = iulib.bytearray()
        iulib.read_image_binary(page_bin, filepath)
        pagewidth = page_bin.dim(0)
        pageheight = page_bin.dim(1)
        out = deepcopy(linedata)
        for i in range(len(linedata)):
            ld = linedata[i]
            coords = ld["box"]
            iulibcoords = (
                coords[0], pageheight - coords[1], coords[0] + coords[2], 
                pageheight - (coords[1] - coords[3]))
            lineimage = iulib.bytearray()
            iulib.extract_subimage(lineimage, page_bin, *iulibcoords)
            out[i]["text"] = self.get_transcript(lineimage)
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
        Convert an on-disk file into an in-memory iulib.bytearray.
        """
        page_gray = iulib.bytearray()
        iulib.read_image_gray(page_gray, filepath)        
        self.logger.info("Binarising image with %s" % self.params.clean)
        preproc = ocropus.make_IBinarize(self.params.clean)
        page_bin = iulib.bytearray()
        preproc.binarize(page_bin, page_gray)
        return page_bin

    @check_aborted
    def get_page_seg(self, page_bin):
        """
        Segment the binary page into a colour-coded segmented images.
        """
        self.logger.info("Segmenting page with %s" % self.params.psegmenter)
        #segmenter = ocropus.make_ISegmentPage(self.params.psegmenter)
        segmenter = components.make_component(self.params.psegmenter, "ISegmentPage")
        for name, val in self.params.iteritems():
            # find the 'long' name for the component with the given short
            # name, i.e: binsauvola -> BinarizeBySauvola
            cmatch = re.match("%s__(.+)" % self.params.psegmenter, name, re.I)
            if cmatch:
                param = cmatch.groups()[0]
                self.logger.info("Setting: %s.%s -> %s" % (self.params.psegmenter, param, val))
                segmenter.pset(param, val)

        page_seg = iulib.intarray()
        segmenter.segment(page_seg, page_bin)
        return page_seg

    @check_aborted
    def get_transcript(self, line):
        """
        Run line-recognition on an iulib.bytearray images of a 
        single line.
        """
        if self._lmodel is None:
            self.init_converter()
        fst = ocropus.make_OcroFST()
        self._linerec.recognizeLine(fst, line)
        result = iulib.ustrg()
        # NOTE: This returns the cost - not currently used
        ocropus.beam_search(result, fst, self._lmodel, 1000)
        return result.as_string()

    @check_aborted
    def standard_preprocess(self, filepath):
        """
        Mimic OCRopus's StandardPreprocessing component but
        allow more flexible param setting.  Somehow.
        """
        complookup = self.get_components(
                oftypes=["IBinarize", "ICleanupGray", "ICleanupBinary"])
        pagegray = iulib.bytearray()
        pageout = iulib.bytearray()
        iulib.read_image_gray(pagegray, filepath)
        self.logger.debug("Page gray initial size: %s" % pagegray.length())
        self.logger.info("Binarizing with params: %s" % self.params)
        # init components
        binarizer = ocropus.make_IBinarize(self.params.binarizer)
        graydeskew = None
        if self.params.graydeskew and self.params.graydeskew != "-":
            graydeskew = ocropus.make_ICleanupGray(self.params.graydeskew)
        bindeskew = None
        if self.params.bindeskew and self.params.bindeskew != "-":
            bindeskew = ocropus.make_ICleanupBinary(self.params.bindeskew)
        cleanups = { "grayclean": [], "binclean": [] }
        for cleantype, cleanlist in cleanups.iteritems():
            for i in range(0, 10): 
                paramval = self.params.get("%s%s" % (cleantype, i))
                if paramval and paramval != "-":
                    try:
                        cleanlist.append(ocropus.make_ICleanupBinary(paramval))
                    except IndexError, err:
                        self.logger.error(err.message)

        self._set_component_parameters(complookup, [binarizer, bindeskew, graydeskew] 
                + cleanups["grayclean"] + cleanups["binclean"])

        # onwards with cleanup
        pageout = pagegray
        deskewed = False
        
        gray = iulib.bytearray()
        tmp = iulib.bytearray()        
        if iulib.contains_only(pageout, 0, 255):
            self.logger.debug("Running BINARY batch clean.")
            pageout = self.batch_clean(cleanups["binclean"], pagegray)            
            if bindeskew:
                self.logger.debug("Deskewing with: %s" % self.params.bindeskew)
                bindeskew.cleanup(tmp, pageout)
                deskewed = True
                pageout.move(tmp)
        else:
            self.logger.debug("Running GRAYSCALE batch clean.")
            pageout = self.batch_clean(cleanups["grayclean"], pagegray)
            if graydeskew:
                self.logger.debug("Deskewing with: %s" % self.params.graydeskew)
                graydeskew.cleanup_gray(tmp, pageout)
                deskewed = True
                pageout.move(tmp)

        self.logger.debug("Page out length: %s" % pageout.length())
        # TODO: Ensure this copy isn't costly...
        gray.copy(pageout)
        tmp.move(pageout)
        try:
            binarizer.binarize(pageout, tmp)
        except StandardError, err:
            self.logger.error("Binarizer failed: %s" % err)
            pageout.move(tmp)
        tmp.move(pageout)
        pageout = self.batch_clean(cleanups["binclean"], tmp)
        self.logger.debug("Page out length: %s" % pageout.length())
        if bindeskew and not deskewed:
            tmp.move(pageout)
            try:
                bindeskew.cleanup(pageout, tmp)
            except StandardError, err:
                self.logger.error("Binary deskew failed: %s" % err)
                pageout.move(tmp)
        return gray, pageout


    @check_aborted
    def batch_clean(self, components, pagedata):
        tmp = iulib.bytearray()
        # TODO: Ditto, benchmark this copy
        pageout = iulib.bytearray()
        pageout.copy(pagedata)
        count = 0
        for component in components:
            self.logger.debug("Running cleanup: %s.  Image size: %s" % (component.name(), pageout.length()))
            try:
                component.cleanup(tmp, pageout)
                pageout.move(tmp)
            except Exception, err:
                self.logger.error("clean%s: %s failed:" % (count, component.name()))
            count += 1

        return pageout


    def load_training_binary(self, imagepath):
        """
        Load an image to use for training.
        """
        self.trainbin = iulib.bytearray()
        iulib.read_image_gray(self.trainbin, imagepath)                


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
        w = self.trainbin.dim(0)
        h = self.trainbin.dim(1)

        ibox = (bbox[0], h - bbox[1],
                bbox[0] + bbox[2] + 1,
                (h - bbox[1]) + bbox[3] + 1)
        sub = iulib.bytearray()
        iulib.extract_subimage(sub, self.trainbin, *ibox)

        try:
            self._linerec.addTrainingLine1(sub, text.encode())
        except Exception, e:
            traceback.print_exc()
            self.logger.error("Skipping training line: %s: %s" % (text, e.message))

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
            except Exception, e:
                self.logger.error("Encounter runtime error: %s" % e.message)
                self.logger.info("Tries left: %d" % tries)
            tries -= 1

        self.logger.info("Saving trained model")
        self.save_trained_model()


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
                if cmatch:
                    param = cmatch.groups()[0]
                    self.logger.info("Setting: %s.%s -> %s" % (compname, param, val))
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



    @classmethod
    def _get_native_components(cls, oftypes=None, withnames=None):
        """
        Get a datastructure contraining all Ocropus native components
        (possibly of a given type) and their default parameters.
        """
        out = {}
        clist = ocropus.ComponentList()
        for i in range(0, clist.length()):
            ckind = clist.kind(i)
            if oftypes and not \
                    ckind.lower() in [c.lower() for c in oftypes]:
                continue
            cname = clist.name(i)
            if withnames and not \
                    cname.lower() in [n.lower() for n in withnames]:
                continue            
            compdict = {"name": cname, "type": ckind, "params": []}
            # this is WELL dodgy
            try:
                comp = eval("ocropus.make_%s(\"%s\")" % (ckind, cname))
            except StandardError, err:
                continue
            compdict["description"] = comp.description()
            compdict["shortname"] = comp.name()
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
        dir = os.path.join(os.path.dirname(__file__), "components")
        for fname in os.listdir(dir):
            if not fname.endswith(".py"):
                continue
            modname = fname.replace(".py", "", 1)
            pm = __import__("%s" % modname, fromlist=["main_class"])
            if not hasattr(pm, "main_class"):
                continue
            ctype = pm.main_class()
            ckind = ctype.__base__.__name__

            # note: the loading function in ocropy/components.py expects
            # python components to have a module-qualified name, i.e:
            # mymodule.MyComponent.
            cname = "%s.%s" % (modname, ctype.__name__)
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

