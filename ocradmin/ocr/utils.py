"""
Generic OCR helper functions and wrapper around various OCRopus
and Tesseract tools.
"""

import os
import re
from datetime import datetime
import subprocess as sp
import uuid

from PIL import Image

from django.utils import simplejson
from django.conf import settings

from HTMLParser import HTMLParser


class HocrParser(HTMLParser):    
    def __init__(self):
        HTMLParser.__init__(self)
        self.data = {}
        self.linecnt = 0
        self.currline = None
        self.boxre = re.compile(".*?bbox (\d+) (\d+) (\d+) (\d+)")
        self.gotpage = False

    def parsefile(self, filename):
        with open(filename, "r") as f:
            for line in f.readlines():
                self.feed(line)
        return self.data                

    def handle_starttag(self, tag, attrs):
        if tag == "div" and not self.gotpage:
            for attr in attrs:
                if attr[0] == "class" and attr[1] == "ocr_page":
                    self.gotpage = True
                    self.data["lines"] = []
                    break
            if self.gotpage:
                for attr in attrs:
                    if attr[0] == "title":
                        boxmatch = self.boxre.match(attr[1])
                        if boxmatch:
                            dims = [int(i) for i in boxmatch.groups()]
                            self.data["box"] = [
                                dims[0], dims[3],
                                dims[2] - dims[0], dims[3] - dims[1]]
                        namematch = re.match("image \"([^\"]+)", attr[1])
                        if namematch:
                            self.data["page"] = namematch.groups()[0]
        elif tag == "span":
            for attr in attrs:
                boxmatch = self.boxre.match(attr[1])
                if boxmatch:
                    dims = [int(i) for i in boxmatch.groups()]
                    box = [
                        dims[0], dims[3], dims[2] - dims[0], dims[3] - dims[1]]
                    self.currline = dict(line=self.linecnt, box=box)
    def handle_data(self, data):
        if self.currline is not None:
            self.currline["text"] = data

    def handle_endtag(self, tag):
        if tag == "span" and self.currline is not None \
                and self.currline.get("text"):
            self.linecnt += 1
            self.data["lines"].append(self.currline.copy())
            self.currline = None




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
                settings.MEDIA_ROOT,
                settings.TEMP_PATH,
                request.user.username,
                datetime.now().strftime("%Y%m%d%H%M%S")
            )
        else:            
            output_path = os.path.join(
                settings.MEDIA_ROOT,
                settings.USER_FILES_PATH, 
                project.slug
            )
        request.__class__.output_path = output_path
        return func(request, *args, **kwargs)
    return wrapper


def get_refpage_path(refpage, filename):
    """
    Get the path for a reference page file.  Called from the
    model FileField's upload_to param.
    """
    return os.path.join(
            "reference",
            refpage.project.slug,
            os.path.splitext(refpage.page_name)[0],
            filename)


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


def get_trainer(*args, **kwargs):
    """
    Get the appropriate class to do the conversion.
    TODO: Convert this function to the plugin interface.
    """
    from ocradmin.ocr.tools.plugins.ocropus_wrapper import OcropusWrapper
    return OcropusWrapper(*args, **kwargs)


                
                
