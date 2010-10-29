"""
Generic OCR helper functions and wrapper around various OCRopus
and Tesseract tools.
"""

import os
import re
import traceback
from datetime import datetime
import logging
import shutil
import tempfile
import subprocess as sp
import uuid
import UserDict
import ocropus
import iulib

from PIL import Image

from django.utils import simplejson
from django.conf import settings






class AppException(StandardError):
    """
    Most generic app error.
    """
    pass


HEADER_TEMPLATE = """
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" 
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> 
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
    <head>
        <title>OCR Results</title>
        <meta name="Description" content="OCRopus Output" />
        <meta name="ocr-system" content="ocropus-0.4" />
        <meta name="ocr-capabilities" content="ocr_line ocr_page" />
    </head>
    <body>
"""

FOOTER_TEMPLATE = """
    </body>
</html>
"""


def saves_files(func):
    """
    Decorator function for other actions that
    require a project to be open in the session.
    """
    def wrapper(request, *args, **kwargs):
        temp = request.path.startswith("/ocr/")
        project = request.session.get("project")
        output_path = None
        if project is None:
            temp = True
        if temp:
            output_path = os.path.join(
                settings.TEMP_ROOT,
                request.user.username,
                datetime.now().strftime("%Y%m%d%H%M%S")
            )
        else:
            output_path = os.path.join(
                settings.USER_FILES_ROOT, 
                project.slug
            )
        if request.path.startswith("/training/save_task"):
            output_path = os.path.join(output_path, "reference")
        request.__class__.output_path = output_path
        return func(request, *args, **kwargs)
    return wrapper




class FileWrangler(object):
    """
    Determine the most appropriate place to put new files
    and uploaded files, based on OCR/batch parameters.
    TODO: Include the project in these considerations.
    """
    def __init__(self, username=None, batch_id=None, 
            project_id=None, action="test", temp=True, 
            training=False, stamp=False):
        self.username = username
        self.action = action
        self.batch_id = batch_id
        self.project_id = project_id
        self.temp = temp
        self.stamp = stamp
        self.training = training

    def __call__(self, infile=None):
        base = settings.MEDIA_ROOT

        if self.temp:
            base = os.path.join(base, "temp")
        else:
            if self.training:
                base = os.path.join(base, "training")
            else:
                base = os.path.join(base, "files")
        if self.username:
            base = os.path.join(base, self.username)
        if self.project_id:
            base = os.path.join(base, "project%06d" % self.project_id)
        if self.batch_id:
            base = os.path.join(base, "batch%06d" % self.batch_id)
        else:
            if self.stamp:
                base = os.path.join(base, datetime.now().strftime("%Y%m%d%H%M%S"))
            if self.action:
                base = os.path.join(base, self.action)
        if infile:
            base = os.path.join(base, os.path.basename(infile)) 
        return os.path.abspath(base)


def get_binary(binname):
    """
    Try and find where Tesseract is installed.
    """
    bin = sp.Popen(["which", binname], 
            stdout=sp.PIPE).communicate()[0].strip()
    if bin and os.path.exists(bin):
        return bin

    for path in ["/usr/local/bin", "/usr/bin"]:
        binpath = os.path.join(path, binname) 
        if os.path.exists(binpath):
            return binpath
    # fallback...
    return binname


def get_ocr_path(user=None, temp=True, subdir="test", unique=False, timestamp=True):
    """
    Get a path for saving temp images.
    """
    basepath = settings.MEDIA_ROOT
    if temp:
        basepath = os.path.join(basepath, "temp")
    else:
        basepath = os.path.join(basepath, "files")
    if user:
        basepath = os.path.join(basepath, user)
    if subdir:
        basepath = os.path.join(basepath, subdir)
    if timestamp:
        basepath = os.path.join(basepath, 
                datetime.now().strftime("%Y%m%d%H%M%S"))
    return basepath



def save_ocr_images(images, path):
    """
    Save OCR images to the media directory...
    """                         
    paths = []
    if not os.path.exists(path):
        os.makedirs(path, 0777)
        try:
            os.chmod(path, 0777)
        except Exception:
            print "CHMOD FAILED: %s" % path

    for _, handle in images:
        filepath = os.path.join(path, handle.name)
        with open(filepath, "wb") as outfile:
            for chunk in handle.chunks():
                outfile.write(chunk)
            paths.append(filepath)
            try:
                os.chmod(filepath, 0777)
            except Exception:
                print "CHMOD FAILED: %s" % filepath
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


def get_media_output_path(inpath, type, ext=".png"):
    """
    Get an output path for a given type of input file.
    """
    base = os.path.splitext(inpath)[0] 
    return  "%s_%s%s" % (base, type, ext)    


def get_ab_output_path(inpath):
    """
    Get an output path appended with either _a or _b depending
    on what the given input, output paths are.  This is so we 
    can switch between two temp paths (and also to prevent
    the SeaDragon viewer from caching images.
    TODO: Make this work less horribly.
    """
    outpath = inpath
    base, ext = os.path.splitext(inpath)

    smatch = re.match("(.+)_(\d+)$", base)
    if smatch:
        pre, inc = smatch.groups()
        outpath = "%s_%03d%s" % (pre, int(inc) + 1, ext)
    else:
        outpath = "%s_001%s" % (base, ext)
    return outpath

def get_new_task_id(filepath=None):
    """
    Get a unique id for a new page task, given it's
    file path.
    """
    if filepath:
        return "%s::%s" % (os.path.basename(filepath), uuid.uuid1()) 
    else:
        return str(uuid.uuid1())


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


def find_unscaled_path(path, strip_ab=False):
    """
    Find the non-scaled path to a temp file.
    """
    uspath = os.path.abspath(path.replace("_scaled", "", 1))
    uspath = os.path.abspath(path.replace(".dzi", ".png", 1))
    if strip_ab:
        uspath = os.path.abspath(path.replace("_a.png", ".png", 1)) 
        uspath = os.path.abspath(path.replace("_b.png", ".png", 1)) 
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

def get_image_dims(inpath):
    """
    Get dimensions WxH of an image file.
    """
    try:
        pil = Image.open(inpath)
        return pil.size
    except IOError, err:
        # fall back on GraphicsMagick if opening fails
        import subprocess as sp
        return sp.Popen(["identify", inpath, "-format", '%w %h'],
                stdout=sp.PIPE).communicate()[0].split()
    

def make_png(inpath, outdir=None):
    """
    PIL has problems with some TIFFs so this is
    a quick way of converting an image.
    """
    if inpath.lower().endswith(".png"):
        return inpath
    if outdir is None:
        outdir = os.path.dirname(inpath)
    fname = os.path.basename(inpath)
    outpath = "%s/%s.png" % (outdir, os.path.splitext(fname)[0])
    if not os.path.exists(outpath):
        sp.call(["convert", inpath, outpath]) 
    return outpath


def media_url_to_path(url):
    """
    Substitute the MEDIA_URL for the MEDIA_ROOT.
    """
    if url:
        url = os.path.abspath(url)
        url = url.replace(settings.MEDIA_URL, settings.MEDIA_ROOT + "/", 1) 
        return os.path.abspath(url)


def media_path_to_url(path):
    """
    Substitute the MEDIA_ROOT for the MEDIA_URL.
    """
    if path:
        path = os.path.abspath(path)
        return path.replace(settings.MEDIA_ROOT, settings.MEDIA_URL, 1)


def output_to_text(jsondata, linesep="\n"):
    """
    Convert page json to plain text.
    """
    return linesep.join([line["text"] for line in jsondata["lines"]])


def output_to_json(jsondata, indent=4):
    """
    Process raw json data to user output, with an indent.
    """
    return simplejson.dumps(jsondata, indent=indent)


def output_to_hocr(jsondata):
    """
    Convert page hocr.
    """

    hocr = HEADER_TEMPLATE
    hocr += "\t<div class='ocr_page' title=\"bbox %d %d %d %d\" image='%s'>\n" % (
        jsondata["box"][0],
        jsondata["box"][1],
        jsondata["box"][2],
        jsondata["box"][3],
        jsondata["page"]
    )
    
    def hocr_line(line):
        return "\t\t<%s title=\"bbox %d %d %d %d\">%s</%s>\n" % (
            line.get("type", "span"),
            line["box"][0],
            line["box"][1],
            line["box"][2],
            line["box"][3],
            line["text"],
            line.get("type", "span"),
        )

    for line in jsondata["lines"]:
        hocr += hocr_line(line)
    hocr += "\t</div>"
    hocr += FOOTER_TEMPLATE

    return hocr


def get_converter(engine_type, *args, **kwargs):
    """
    Get the appropriate class to do the conversion.
    """
    if engine_type == "ocropus":
        return OcropusWrapper(*args, **kwargs)
    elif engine_type == "cuneiform":
        return CuneiformWrapper(*args, **kwargs)
    elif engine_type == "gocr":
        return GocrWrapper(*args, **kwargs)
    else:
        return TessWrapper(*args, **kwargs)


def get_trainer(*args, **kwargs):
    """
    Get the appropriate class to do the conversion.
    """
    return OcropusWrapper(*args, **kwargs)


def get_ocropus_components(oftypes=None, withnames=None):
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


def set_progress(logger, progress_func, step, end, granularity=5):
    """
    Call a progress function, if supplied.  Only call
    every 5 steps.  Also set the total todo, i.e. the
    number of lines to process.
    """
    if progress_func is None:
        return
    if not (step and end):
        return
    if step != end and step % granularity != 0:
        return
    perc = min(100.0, round(float(step) / float(end), 2) * 100)
    progress_func(perc, end)


class AbortedAction(StandardError):
    """
    Exception to raise when execution is aborted.
    """
    pass


def check_aborted(method):
    def wrapper(*args, **kwargs):
        instance = args[0]
        if instance.abort_func is not None:
            if instance.abort_func():
                instance.logger.warning("Aborted")
                raise AbortedAction(method.func_name)
        return method(*args, **kwargs)
    return wrapper


class OcropusWrapper(object):
    """
    Wrapper around OCRopus's basic page-recognition functions so
    that bits and peices can be reused more easily.
    """
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
        segmenter = ocropus.make_ISegmentPage(self.params.psegmenter)
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
        complookup = get_ocropus_components(
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


    def init_converter(self):
        """
        Extract the lmodel to a temporary directory.  This is
        cleaned up in the destructor.
        """
        if self.params.lmodel and self._tessdata is None:
            self.unpack_tessdata(self.params.lmodel)
        self._tesseract = get_binary("tesseract")
        self.logger.info("Using Tesseract: %s" % self._tesseract)

    @check_aborted
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

    @check_aborted
    def process_line(self, imagepath):
        """
        Run Tesseract on the TIFF image, using YET ANOTHER temporary
        file to gather the output, which is then read back in.  If
        you think this seems horribly inefficient you'd be right, but
        Tesseract's external interface is quite inflexible.
        TODO: Fix hardcoded path to Tesseract.
        """
        if self._tessdata is None:
            self.init_converter()

        lines = []
        with tempfile.NamedTemporaryFile() as tmp:
            tmp.close()
            tessargs = [self._tesseract, imagepath, tmp.name]
            if self._lang is not None:
                tessargs.extend(["-l", self._lang])               
            proc = sp.Popen(tessargs, stderr=sp.PIPE)
            err = proc.stderr.read()
            if proc.wait() != 0:
                return "!!! TESSERACT CONVERSION ERROR %d !!!" % proc.returncode
                #raise RuntimeError(
                #    "tesseract failed with errno %d: %s" % (
                #        proc.returncode, err))
            
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


class GenericLineWrapper(OcropusWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use generic OCRs for recognition of individual lines.
    """
    binary = "unimplemented"

    def get_command(self, *args, **kwargs):
        """
        Get the command line for converting a given image.
        """
        raise NotImplementedError


    @check_aborted
    def get_transcript(self, line):
        """
        Recognise each individual line by writing it as a temporary
        PNG and calling self.binary on the image.  
        """
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.close()
            iulib.write_image_binary(tmp.name, line)
            text = self.process_line(tmp.name)
            os.unlink(tmp.name)
            return text            


    @check_aborted
    def process_line(self, imagepath):
        """
        Run OCR on image, using YET ANOTHER temporary
        file to gather the output, which is then read back in. 
        """
        lines = []
        with tempfile.NamedTemporaryFile() as tmp:
            tmp.close()
            args = self.get_command(outfile=tmp.name, image=imagepath)
            self.logger.info(args)
            proc = sp.Popen(args, stderr=sp.PIPE)
            err = proc.stderr.read()
            if proc.wait() != 0:
                return "!!! %s CONVERSION ERROR %d: %s !!!" % (
                        os.path.basename(self.binary).upper(),
                        proc.returncode, err)
            
            # read and delete the temp text file
            # whilst writing to our file
            with open(tmp.name, "r") as txt:
                lines = [line.rstrip() for line in txt.readlines()]
                if lines and lines[-1] == "":
                    lines = lines[:-1]
                os.unlink(txt.name)        
        return " ".join(lines)



class CuneiformWrapper(GenericLineWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Cuneiform for recognition of individual lines.
    """

    binary = get_binary("cuneiform")

    def get_command(self, outfile, image):
        """
        Cuneiform command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, image] 


class GocrWrapper(GenericLineWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Gocr for recognition of individual lines.
    """

    binary = get_binary("gocr")

    def get_command(self, outfile, image):
        """
        GOCR command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, "-i", image] 


                
                
