"""
Generic OCR helper functions and wrapper around various OCRopus
and Tesseract tools.
"""

import os
import re
from datetime import datetime
import logging
import shutil
import tempfile
import subprocess as sp
import UserDict
import ocropus
import iulib

from PIL import Image

from django.conf import settings


def get_tesseract():
    """
    Try and find where Tesseract is installed.
    """
    return sp.Popen(["which", "tesseract"], 
            stdout=sp.PIPE).communicate()[0].strip()


def save_ocr_images(images, basepath, temp=True):
    """
    Save OCR images to the media directory...
    """                         
    paths = []
    if temp:
        basepath = os.path.join(basepath, "temp")
    basepath = os.path.join(basepath, datetime.now().strftime("%Y%m%d%H%M%S"))
    if not os.path.exists(basepath):
        os.makedirs(basepath, 0777)

    for _, handle in images:
        path = os.path.join(basepath, handle.name)
        with open(path, "wb") as outfile:
            for chunk in handle.chunks():
                outfile.write(chunk)
            paths.append(path)
    return paths




def convert_to_temp_image(imagepath, suffix="tif"):
    """
    Convert PNG to TIFF with GraphicsMagick.  This seems
    more reliable than PIL, which seems to have problems
    with Group4 TIFF encoders.
    """
    with tempfile.NamedTemporaryFile(suffix=".%s" % suffix) as tmp:
        tmp.close()
        retcode = sp.call(["convert", imagepath, tmp.name])
        if not retcode == 0:
            raise ExternalToolError(
                "convert failed to create TIFF file with errno %d" % retcode) 
        return tmp.name


def find_file_with_basename(pathbase):
    """
    Get the first file with the given basename (full path
    minus the extension.)
    """
    basename = os.path.basename(pathbase)
    dirname = os.path.dirname(pathbase)
    candidates = [fname for fname in os.listdir(dirname) \
            if fname.startswith(basename)]
    if candidates:
        return os.path.join(dirname, candidates[0])
    return pathbase


def find_unscaled_path(path):
    """
    Find the non-scaled path to a temp file.
    """
    uspath = os.path.abspath(path.replace("_scaled", "", 1))
    uspath = os.path.abspath(path.replace(".dzi", ".png", 1))
    if not os.path.exists(uspath):
        uspath = find_file_with_basename(
                os.path.splitext(uspath)[0])
    return uspath


def new_size_from_width(currentsize, width):
    """
    Maintain aspect ratio when scaling to a new width.
    """

    cw, ch = currentsize
    caspect = float(cw) / float(ch)
    return width, int(width / caspect)


def scale_image(inpath, outpath, newsize, filter=Image.ANTIALIAS):
    """
    Scale an on-disk image to a new size using PIL.
    """
    try:
        pil = Image.open(inpath)
        scaled = pil.resize(newsize, filter)
        scaled.save(outpath, "PNG")
    except IOError, err:
        # fall back on GraphicsMagick if opening fails
        import subprocess as sp
        sp.call(["convert", inpath, "-resize", "%sx%s" % newsize, outpath])

def make_png(inpath):
    """
    PIL has problems with some TIFFs so this is
    a quick way of converting an image.
    """
    if inpath.lower().endswith(".png"):
        return inpath
    outpath = "%s.png" % os.path.splitext(inpath)[0]
    sp.call(["convert", inpath, outpath]) 
    return outpath


def media_url_to_path(url):
    """
    Substitute the MEDIA_URL for the MEDIA_ROOT.
    """
    url = os.path.abspath(url)
    return url.replace(settings.MEDIA_URL, settings.MEDIA_ROOT, 1)


def media_path_to_url(path):
    """
    Substitute the MEDIA_ROOT for the MEDIA_URL.
    """
    path = os.path.abspath(path)
    return path.replace(settings.MEDIA_ROOT, settings.MEDIA_URL, 1)


def output_to_plain_text(jsondata):
    """
    Convert page json to plain text.
    """
    return " ".join([line["text"] for line in jsondata["lines"]])


def get_converter(engine_type, logger, params):
    """
    Get the appropriate class to do the conversion.
    """
    if engine_type == "ocropus":
        return OcropusWrapper(logger, params)
    else:
        return TessWrapper(logger, params)


def get_ocropus_components(oftypes=None):
    """
    Get a datastructure contraining all Ocropus components
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



class OcropusParameter(object):
    """
    Representation of an OCRopus parameter.
    """
    def __init__(self, name, default):
        self.name = name
        self.default = default
        self.val = default

    def set(self, val):
        self.val = val

    def get(self):
        return self.val

    def __repr__(self):
        return "<Param: %s=%s>" % (self.name, self.val)




class OcropusComponent(object):
    """
    Representation of an OCRopus component.
    """
    def __init__(self, name, description):
        """
        Initialise a component.
        """
        self.name = name
        self.description = description
        self._parameters = []

    def parameters(self):
        """
        List all parameters.
        """
        return self._parameters

    def set_parameters(self, paramlist):
        """
        Set all parameters.
        """
        self._parameters = paramlist

    def add_parameter(self, param):
        """
        Add a parameter to the component's parameter list.
        """
        self._parameters.append(param)

    def pset(self, name, val):
        """
        Set the value of a given parameter.
        """
        self._find_param(name).set(val)

    def pget(self, name):
        """
        Get the value of a given parameter.
        """
        return self._find_param(name).get()

    def _find_param(self, name):
        """
        Find a given parameter.
        """
        try:
            param = [p for p in self._parameters if p.name == name][0]
        except IndexError, err:
            raise ComponentError("Parameter '%s' not found")
        return param

    def __repr__(self):
        """
        Generic string representation.
        """
        return "<%s: %s>" % (self.__class__.__name__, self.name)


class ComponentError(StandardError):
    """
    Component related exceptions.
    """
    pass


class OcropusError(StandardError):
    """
    Ocropus-related exceptions.
    """
    pass


class ExternalToolError(StandardError):
    """
    Errors with external command-line tools etc.
    """
    pass


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
        self.pseg = "SegmentPageByRAST"
        self.clean = "StandardPreprocessing"
        self.binarizer = "BinarizeBySauvola"
        self.graydeskew = "DeskewPageByRAST"
        self.bindeskew = "DeskewPageByRAST"
        self.binclean0 = "AutoInvert"
        self.binclean1 = "RmHalftone"
        self.binclean2 = "RmBig"

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


class OcropusWrapper(object):
    """
    Wrapper around OCRopus's basic page-recognition functions so
    that bits and peices can be reused more easily.
    """
    def __init__(self, logger=None, params=None):
        """
        Initialise an OcropusWrapper object.
        """
        self._linerec = None
        self._lmodel = None
        self.logger = logger if logger else self.get_default_logger()
        self.params = OcropusParams(params) if params \
                else OcropusParams({})


    def init(self):
        """
        Load the line-recogniser and the lmodel FST objects.
        """
        try:
            self._linerec = ocropus.load_linerec(self.params.cmodel)
            self._lmodel = ocropus.make_OcroFST()
            self._lmodel.load(self.params.lmodel)
        except (StandardError, RuntimeError), err:
            raise err
            
    
    def convert(self, filepath, callback=None, **cbkwargs):
        """
        Convert an image file into text.  A callback can be supplied that
        is evaluated before every individual page line is run.  If it does
        not evaluate to True the function returns early with the page 
        results gathered up to that point.  Keyword arguments can also be
        passed to the callback.
        """
        _, page_bin = self.standard_preprocess(filepath)
        page_seg = self.get_page_seg(page_bin)
        pagewidth = page_seg.dim(0)
        pageheight = page_seg.dim(1)
        
        self.logger.info("Extracting regions...")
        regions = ocropus.RegionExtractor()
        regions.setPageLines(page_seg)
        
        self.logger.info("Recognising lines...")
        pagedata = { 
            "page" : os.path.basename(filepath) ,
            "lines": [],
            "box": [0, 0, pagewidth, pageheight]
        }
        for i in range(1, regions.length()):
            # test for continuation
            if callback is not None:
                if not callback(**cbkwargs):
                    return pagedata

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
        return pagedata


    def get_default_logger(self):
        """
        Initialize a default logger to stderr.
        """
        logging.basicConfig(level=logging.DEBUG)
        return logging.getLogger(self.__class__.__name__)


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


    def get_page_seg(self, page_bin):
        """
        Segment the binary page into a colour-coded segmented images.
        """
        self.logger.info("Segmenting page with %s" % self.params.pseg)
        segmenter = ocropus.make_ISegmentPage(self.params.pseg)
        for name, val in self.params.iteritems():
            # find the 'long' name for the component with the given short
            # name, i.e: binsauvola -> BinarizeBySauvola
            cmatch = re.match("%s__(.+)" % self.params.pseg, name, re.I)
            if cmatch:
                param = cmatch.groups()[0]
                self.logger.info("Setting: %s.%s -> %s" % (self.params.pseg, param, val))
                segmenter.pset(param, val)

        page_seg = iulib.intarray()
        segmenter.segment(page_seg, page_bin)
        return page_seg


    def get_transcript(self, line):
        """
        Run line-recognition on an iulib.bytearray images of a 
        single line.
        """
        if self._lmodel is None:
            self.init()
        fst = ocropus.make_OcroFST()
        self._linerec.recognizeLine(fst, line)
        result = iulib.ustrg()
        # NOTE: This returns the cost - not currently used
        ocropus.beam_search(result, fst, self._lmodel, 1000)
        return result.as_string()


    def standard_preprocess(self, filepath):
        """
        Mimic OCRopus's StandardPreprocessing component but
        allow more flexible param setting.  Somehow.
        """
        components = get_ocropus_components(
                oftypes=["IBinarize", "ICleanupGray", "ICleanupBinary"])
        pagegray = iulib.bytearray()
        pageout = iulib.bytearray()
        iulib.read_image_gray(pagegray, filepath)
        self.logger.debug("Page gray initial size: %s" % pagegray.length())
        self.logger.info("Binarizing with params: %s" % self.params)
        # init components
        binarizer = ocropus.make_IBinarize(self.params.binarizer)
        graydeskew = None
        if self.params.graydeskew:
            graydeskew = ocropus.make_ICleanupGray(self.params.graydeskew)
        bindeskew = None
        if self.params.bindeskew:
            bindeskew = ocropus.make_ICleanupBinary(self.params.bindeskew)
        cleanups = { "grayclean": [], "binclean": [] }
        for cleantype, cleanlist in cleanups.iteritems():
            for i in range(0, 10): 
                paramval = self.params.get("%s%s" % (cleantype, i))
                if paramval:
                    try:
                        cleanlist.append(ocropus.make_ICleanupBinary(paramval))
                    except IndexError, err:
                        self.logger.error(err.message)

        # set all the parameters on our components
        for component in [binarizer, bindeskew, graydeskew] + \
                cleanups["grayclean"] + cleanups["binclean"]:
            if component is None:
                continue
            for name, val in self.params.iteritems():
                # find the 'long' name for the component with the given short
                # name, i.e: binsauvola -> BinarizeBySauvola
                compname = [comp["name"] for comp in components.itervalues() \
                        if comp["shortname"] == component.name()][0]
                cmatch = re.match("%s__(.+)" % compname, name, re.I)
                if cmatch:
                    param = cmatch.groups()[0]
                    self.logger.info("Setting: %s.%s -> %s" % (compname, param, val))
                    component.pset(param, val)

        # onwards with cleanup
        pageout = pagegray
        deskewed = False
        
        gray = iulib.bytearray()
        tmp = iulib.bytearray()        
        if iulib.contains_only(pageout, 0, 255):
            self.logger.debug("Running BINARY batch clean.")
            pageout = self._batch_clean(cleanups["binclean"], pagegray)            
            if bindeskew:
                self.logger.debug("Deskewing with: %s" % self.params.bindeskew)
                bindeskew.cleanup(tmp, pageout)
                deskewed = True
                pageout.move(tmp)
        else:
            self.logger.debug("Running GRAYSCALE batch clean.")
            pageout = self._batch_clean(cleanups["grayclean"], pagegray)
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
        pageout = self._batch_clean(cleanups["binclean"], tmp)
        self.logger.debug("Page out length: %s" % pageout.length())
        if bindeskew and not deskewed:
            tmp.move(pageout)
            try:
                bindeskew.cleanup(pageout, tmp)
            except StandardError, err:
                self.logger.error("Binary deskew failed: %s" % err)
                pageout.move(tmp)
        return gray, pageout


    def _batch_clean(self, components, pagedata):
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

 


class TessWrapper(OcropusWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Tesseract for recognition of individual lines.
    """
    def __init__(self, *args, **kwargs):
        """
        Initialise a TessWrapper object.
        """
        self._tessdata = None
        self._lang = None
        self._tesseract = None
        super(TessWrapper, self).__init__(*args, **kwargs)


    def init(self):
        """
        Extract the lmodel to a temporary directory.  This is
        cleaned up in the destructor.
        """
        if self.params.lmodel and self._tessdata is None:
            self.unpack_tessdata(self.params.lmodel)
        self._tesseract = get_tesseract()
        self.logger.info("Using Tesseract: %s" % self._tesseract)


    def get_transcript(self, line):
        """
        Recognise each individual line by writing it as a temporary
        PNG, converting it to Tiff, and calling Tesseract on the
        image.  Unfortunately I can't get the current stable 
        Tesseract 2.04 to support anything except TIFFs.
        """
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.close()
            iulib.write_image_binary(tmp.name, line)
            tiff = convert_to_temp_image(tmp.name, "tif")
            text = self.process_line(tiff)
            os.unlink(tmp.name)
            os.unlink(tiff)
            return text            


    def unpack_tessdata(self, lmodelpath):
        """
        Unpack the tar-gzipped Tesseract language files into
        a temporary directory and set TESSDATA_PREFIX environ
        var to point at it.
        """
        # might as well make this even less efficient!
        self.logger.info("Unpacking tessdata: %s" % lmodelpath)
        import tarfile
        self._tessdata = tempfile.mkdtemp() + "/"
        datapath = os.path.join(self._tessdata, "tessdata")
        os.mkdir(datapath)
        # let this throw an exception if it fails.
        tgz = tarfile.open(lmodelpath, "r:*")
        self._lang = os.path.splitext(tgz.getnames()[0])[0]
        tgz.extractall(path=datapath)
        tgz.close()

        # set environ var where tesseract picks up the tessdata dir
        # this DOESN'T include the "tessdata" part
        os.environ["TESSDATA_PREFIX"] = self._tessdata


    def process_line(self, imagepath):
        """
        Run Tesseract on the TIFF image, using YET ANOTHER temporary
        file to gather the output, which is then read back in.  If
        you think this seems horribly inefficient you'd be right, but
        Tesseract's external interface is quite inflexible.
        TODO: Fix hardcoded path to Tesseract.
        """
        if self._tessdata is None:
            self.init()

        lines = []
        with tempfile.NamedTemporaryFile() as tmp:
            tmp.close()
            tessargs = [self._tesseract, imagepath, tmp.name]
            if self._lang is not None:
                tessargs.extend(["-l", self._lang])               
            proc = sp.Popen(tessargs, stderr=sp.PIPE)
            err = proc.stderr.read()
            if proc.wait() != 0:
                raise RuntimeError(
                    "tesseract failed with errno %d: %s" % (
                        proc.returncode, err))
            
            # read and delete Tesseract's temp text file
            # whilst writing to our file
            with open(tmp.name + ".txt", "r") as txt:
                lines = [line.rstrip() for line in txt.readlines()]
                if lines and lines[-1] == "":
                    lines = lines[:-1]
                os.unlink(txt.name)        
        return " ".join(lines)


    def __del__(self):
        """
        Cleanup temporarily-extracted lmodel directory.
        """
        if self._tessdata and os.path.exists(self._tessdata):
            try:
                self.logger.info(
                    "Cleaning up temp tessdata folder: %s" % self._tessdata)
                shutil.rmtree(self._tessdata)
            except OSError, (errno, strerr):
                self.logger.error(
                    "RmTree raised error: %s, %s" % (errno, strerr))

