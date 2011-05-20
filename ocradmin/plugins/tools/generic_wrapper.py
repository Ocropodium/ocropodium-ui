"""
Generic wrapper for tools that accept a single line image and
return a single line of text.
"""


import os
import re
import traceback
import UserDict
import tempfile
import subprocess as sp
from ocradmin.plugins import base, check_aborted, get_binary, ExternalToolError, set_progress
#reload(base)
import ocrolib

from ocradmin.plugins import parameters

import generic_options
#reload(generic_options)

class GenericWrapper(base.OcrBase):
    """
    Override certain methods of the OcropusWrapper to
    use generic OCRs for recognition of individual lines.
    """
    name = "generic"
    description = "Generic command-line OCR wrapper"
    binary = "unimplemented"

    def __init__(self, logger=None, abort_func=None, config=None):
        """
        Initialise an OcropusWrapper object.
        """
        self.config = config if config is not None \
                else parameters.OcrParameters.from_parameters(
                        dict(name=self.name, value=self.get_parameters()))
        self.abort_func = abort_func
        self.logger = logger if logger else self.get_default_logger()

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

    @classmethod
    def extract_boxes(cls, page_seg):
        """
        Extract line/paragraph geometry info.
        """
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


    def get_command(self, *args, **kwargs):
        """
        Get the command line for converting a given image.
        """
        raise NotImplementedError

    def convert(self, filepath, progress_func=None,
            callback=None, cbkwargs=None, **kwargs):
        """
        Convert an image file into text.  A callback can be supplied that
        is evaluated before every individual page line is run.  If it does
        not evaluate to True the function returns early with the page
        results gathered up to that point.  Keyword arguments can also be
        passed to the callback.
        """
        page_bin = self.conditional_preprocess(filepath, kwargs.get("prebinarized"))
        page_seg = self.get_page_seg(page_bin)
        if kwargs.get("seg_out"):
            self.logger.info("Writing segmentation: %s" % kwargs.get("seg_out"))
            self.write_packed(kwargs.get("seg_out"), page_seg)
        if kwargs.get("bin_out"):
            self.logger.info("Writing binary: %s" % kwargs.get("bin_out"))
            self.write_binary(kwargs.get("bin_out"), page_bin)
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
                args = {} if cbkwargs is None else cbkwargs
                if not callback(**args):
                    return pagedata
            set_progress(self.logger, progress_func, i, numlines)
            line = regions.extract(page_bin, i, 1)
            bbox = [regions.x0(i), regions.y0(i) + (regions.y1(i) - regions.y0(i)),
                regions.x1(i) - regions.x0(i), regions.y1(i) - regions.y0(i)]

            text = self.get_transcript(line)
            pagedata["lines"].append({"line": i, "box": bbox, "text" : text })

        # set progress complete
        set_progress(self.logger, progress_func, numlines, numlines)
        return pagedata

    @check_aborted
    def get_page_binary(self, filepath):
        """
        Convert an on-disk file into an in-memory ocrolib.iulib.bytearray.
        """
        page_gray = ocrolib.read_image_gray(filepath)
        self.logger.info("Binarising image with %s" % self.config.binarizer.name)
        preproc = getattr(ocrolib, self.config.binarizer.name)()
        return preproc.binarize(page_gray)

    @check_aborted
    def get_page_seg(self, page_bin):
        """
        Segment the binary page into a colour-coded segmented images.
        """
        return self.apply_processor(
                self.config.page_segmenter, page_bin, func="segment")

    @check_aborted
    def get_cleaned_grayscale(self, page_data):
        """
        Apply grayscale preprocessing.
        """
        if not hasattr(self.config, "grayscale_preprocessing"):
            return page_data
        cleaned = page_data
        for param in self.config.grayscale_preprocessing:
            cleaned = self.apply_processor(param, cleaned)
        return cleaned

    @check_aborted
    def get_cleaned_binary(self, page_data):
        """
        Apply grayscale preprocessing.
        """
        if not hasattr(self.config, "binary_preprocessing"):
            return page_data
        cleaned = page_data
        for param in self.config.binary_preprocessing:
            if param is not None:
                cleaned = self.apply_processor(param, cleaned)
        return cleaned

    @check_aborted
    def standard_preprocess(self, filepath):
        """
        One-stop function for preprocessing a file.
        """
        page_gray = ocrolib.read_image_gray(filepath)
        return self.get_page_clean(page_gray)

    @check_aborted
    def get_page_clean(self, page_data):
        """
        Binarise a page and apply grey and binary cleanup.
        """
        cleaned = self.get_cleaned_grayscale(page_data)
        binary, gray = self.apply_processor(
                self.config.binarizer, cleaned, func="binarize")
        return self.get_cleaned_binary(binary)

    @check_aborted
    def apply_processor(self, process, data, func="cleanup"):
        """
        Apply a single preprocessing step.
        """
        self.logger.info("Applying preprocessor: %s" % process)
        self.logger.info("    Name: %s" % process.name)
        comp = self.load_component(process.name)
        for p in process.value:
            if p is None:
                continue
            self.logger.info("Setting param: %s.%s -> %s" % (process.name,
                p["name"].encode(), p["value"].encode()))
            comp.pset(p["name"].encode(), p["value"].encode())
        call = getattr(comp, func)
        return call(data)

    def convert_lines(self, filepath, linedata, **kwargs):
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

    @classmethod
    def get_component_parameters(cls, component, *args, **kwargs):
        """
        Get general component parameters.
        """
        comps = cls.get_components(withnames=[component], exclude=["StandardPreprocessing"])
        if len(comps):
            return comps[0]

    def conditional_preprocess(self, filepath, prebinarized=False):
        """
        Run preprocessing unless we're told to
        use a passed-in prebinarized file.
        """
        if prebinarized:
            page_bin = ocrolib.read_image_gray(filepath)
        else:
            page_gray = ocrolib.read_image_gray(filepath)
            page_bin = self.get_page_clean(page_gray)
        return page_bin

    @check_aborted
    def get_transcript(self, line):
        """
        Recognise each individual line by writing it as a temporary
        PNG and calling self.binary on the image.
        """
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.close()
            self.write_binary(tmp.name, line)
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
            if not os.path.exists(args[0]):
                raise ExternalToolError("Unable to find binary: '%s'" % args[0])
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

    @classmethod
    def get_components(cls, oftypes=None, withnames=None, exclude=None):
        """
        Get a datastructure contraining all Ocropus components
        (possibly of a given type) and their default parameters.
        """
        out = cls._get_native_components(oftypes, withnames, exclude=exclude)
        out.extend(cls._get_python_components(oftypes, withnames, exclude=exclude))
        return sorted(out, lambda x, y: cmp(x["name"], y["name"]))

    @classmethod
    def load_component(cls, name):
        try:
            comp = getattr(ocrolib, name)()
        except AttributeError:
            comp = cls._load_python_component(name)
        return comp

    @classmethod
    def _load_python_component(cls, name):
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
                if hasattr(pmod, name):
                    comp = getattr(pmod, name)
                    break
            except ImportError, err:
                pass
        if comp is None:
            raise IndexError("no such component: %s" % name)
        return comp()

