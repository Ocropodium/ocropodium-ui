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
from ocradmin.core.tools import base, check_aborted, get_binary, ExternalToolError, set_progress
import ocrolib

from ocradmin.plugins import parameters



class GenericWrapper(base.OcrBase):
    """
    Override certain methods of the OcropusWrapper to
    use generic OCRs for recognition of individual lines.
    """
    name = "generic"
    description = "Generic command-line OCR wrapper"
    binary = "unimplemented"


    # map of friendly names to OCRopus component names    
    _component_map = dict(
        grayscale_preprocessing="ICleanupGray",
        binary_preprocessing="ICleanupBinary",
        binarizer="IBinarize",
        page_segmenter="ISegmentPage",
    )

    _ignored_components = [
        "StandardPreprocessing",
    ]

    def __init__(self, logger=None, abort_func=None, config=None):
        """
        Initialise an OcropusWrapper object.
        """
        self.config = config if config is not None \
                else parameters.OcrParameters.from_parameters(
                        dict(name=self.name, value=self.parameters()))
        self.abort_func = abort_func
        self.logger = logger if logger else self.get_default_logger()

    @classmethod
    def parameters(cls):
        """
        Get parameters for this plugin.
        """
        # top-level parameters
        return [{
                "name": "grayscale_preprocessing",
                "description": "Greyscale Preprocessor",
                "type": "list",
                "help": "Filters for preprocessing greyscale images",
                "value": [],
                "multiple": True,
                "choices": cls.get_components(oftypes=["ICleanupGray"], 
                    exclude=cls._ignored_components),
            }, {
                "name": "binarizer",
                "description": "Binarizer",
                "type": "list",
                "help": "Filter for binarizing greyscale images",
                "value": "BinarizeBySauvola",
                "multiple": False,
                "choices": cls.get_components(oftypes=["IBinarize"], 
                    exclude=cls._ignored_components),
            }, {
                "name": "binary_preprocessing",
                "description": "Binary Preprocessor",
                "type": "object",
                'value': ['DeskewPageByRAST', 'RmBig', 'RmHalftone'],
                "help": "Filters for preprocessing binary images",
                "multiple": True,
                "choices": cls.get_components(oftypes=["ICleanupBinary"], 
                    exclude=cls._ignored_components),
            }, {
                "name": "page_segmenter",
                "description": "Page Segmenter",
                "type": "object",
                "value": "SegmentPageByRAST",
                "help": "Algorithm for segmenting binary page images",
                "multiple": False,
                "choices": cls.get_components(oftypes=["ISegmentPage"], 
                    exclude=cls._ignored_components),
            },
        ]


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
    def _get_toplevel_parameter_info(cls, name):
        try:
            out = [i for i in cls.parameters() if i["name"] == name][0]
        except IndexError:
            out = None
        return out            



    def get_command(self, *args, **kwargs):
        """
        Get the command line for converting a given image.
        """
        raise NotImplementedError


    @classmethod
    def get_parameters(cls, *args):
        """
        Get general OCR parameters.  
        """
        # Note: we ignore all but the last args given here,
        # because other plugins might implement nested options
        # as a proper tree structure
        if len(args) == 0:
            return dict(
                name="%s" % cls.name,
                type="list",
                description="Available configuration for OCR settings",
                parameters=cls.parameters(),
            )
        elif hasattr(cls, "_get_%s_parameter_info" % args[-1]):
            return getattr(cls, "_get_%s_parameter_info" % args[-1])()
        elif cls._component_map.get(args[-1]):
            return cls._get_toplevel_parameter_info(args[-1])
        else:
            return cls.get_component_parameters(args[-1])


    @classmethod
    def extract_boxes(cls, page_seg):
        """
        Extract line/paragraph geometry info.
        """
        regions = ocrolib.RegionExtractor()
        out = dict(columns=[], lines=[], paragraphs=[])
        exfuncs = dict(
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
                compdict = dict(
                    name=cname,
                    type="list",
                    description=comp.description(),
                    parameters=[])
            except (AttributeError, AssertionError, IndexError):
                continue
            for paramnum in range(0, comp.plength()):
                pname = comp.pname(paramnum)
                compdict["parameters"].append(dict(
                    name=pname,
                    type="scalar",
                    value=comp.pget(pname),
                    description="",
                    choices=None,
                ))
            out.append(compdict)
        return out


    @classmethod
    def _get_python_components(cls, oftypes=None, withnames=None, exclude=None):
        """
        Get native python components.
        """
        out = []
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
            if exclude and cname.lower() in [n.lower() for n in exclude]:
                continue
            comp = ctype()
            # FIXME: Extreme dodginess getting the interface type,
            # very fragile
            compdict = dict(
                name=cname,
                type="list",
                parameters=[],
                description=comp.description()
            )
            for paramnum in range(0, comp.plength()):
                pname = comp.pname(paramnum)
                compdict["parameters"].append(dict(
                    name=pname,
                    description="",
                    type="scalar",
                    value=comp.pget(pname),
                    choices=None,
                ))
            out.append(compdict)
        return out



