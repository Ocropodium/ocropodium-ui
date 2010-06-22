
import os
from datetime import datetime
import shutil
import tempfile
import subprocess as sp
from django.conf import settings

import ocropus
import iulib

def save_ocr_images(images, temp=True):
    """
        Save OCR images to the media directory...
    """

    paths = []
    basepath = settings.MEDIA_ROOT
    if temp:
        basepath = os.path.join(basepath, "temp")
    basepath = os.path.join(basepath, datetime.now().strftime("%Y%m%d%H%M%S"))
    if not os.path.exists(basepath):
        os.makedirs(basepath, 0777)

    for name, fh in images:
        path = os.path.join(basepath, fh.name)
        with open(path, "wb") as outfile:
            for chunk in fh.chunks():
                outfile.write(chunk)
            paths.append(path)
    return paths


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



class OcropusWrapper(object):
    def __init__(self, logger, params):
        self.logger = logger
        self.params = params
        self.init()


    def init(self):
        # the actual transcript is done by calling a transcript
        # function with a language model and an iulib.bytearray.
        # OCRopus also needs a linerec object loaded from a 
        # character model file.
        try:
            self._linerec = ocropus.load_linerec(self.params.get("cmodel").encode())
            self._lmodel = ocropus.make_OcroFST()
            self._lmodel.load(self.params.get("lmodel").encode())
        except Exception:
            raise Exception("Linerec loading exception for %s: %s" % 
                    (self.params.get("cmodel"), e.message))
            
    
    def convert(self, filepath, callback=None, **cbargs):
        """
        Do the actual work"
        """

        page_bin = self.get_page_binary(filepath)
        page_seg = self.get_page_seg(page_bin)
        pagewidth = page_seg.dim(0)
        pageheight = page_seg.dim(1)
        
        self.logger.info("Extracting regions...")
        regions = ocropus.RegionExtractor()
        regions.setPageLines(page_seg)
        
        self.logger.info("Recognising lines...")
        pagedata = { "page" : os.path.basename(filepath) , "lines": [], "box": [0, 0, pagewidth, pageheight]}
        for i in range(1, regions.length()):
            if callback is not None:
                if not callback(**cbargs):
                    return pagedata

            line = iulib.bytearray()
            regions.extract(line, page_bin, i, 1)        
            bbox = [regions.x0(i), pageheight - regions.y0(i),
                regions.x1(i) - regions.x0(i), regions.y1(i) - regions.y0(i)]            
            try:
                text = self.get_transcript(line)
            except StandardError, e:
                text = ""
            pagedata["lines"].append({"line": i, "box": bbox, "text" : text })
        return pagedata

    def get_page_binary(self, filepath):
        page_gray = iulib.bytearray()
        iulib.read_image_gray(page_gray, filepath)        
        self.logger.info("Binarising image with %s" % self.params.get("clean"))
        preproc = ocropus.make_IBinarize(self.params.get("clean").encode())
        page_bin = iulib.bytearray()
        preproc.binarize(page_bin, page_gray)
        return page_bin

    def get_page_seg(self, page_bin):
        self.logger.info("Segmenting page with %s" % self.params.get("pseg"))
        segmenter = ocropus.make_ISegmentPage(self.params.get("pseg").encode())
        page_seg = iulib.intarray()
        segmenter.segment(page_seg, page_bin)
        return page_seg

    def get_transcript(self, line):
        fst = ocropus.make_OcroFST()
        self._linerec.recognizeLine(fst, line)
        result = iulib.ustrg()
        cost = ocropus.beam_search(result, fst, self._lmodel, 1000)
        return result.as_string()





class TessWrapper(OcropusWrapper):
    def __init__(self, *args, **kwargs):
        self._tessdata = None
        self._lang = None
        super(TessWrapper, self).__init__(*args, **kwargs)

    def init(self):
        pass        

    def get_transcript(self, line):
        """
        linerec is a dummy param so we can plug this class in and
        call it as a get_transcript function in place of the ocropus
        one.  TODO: Fix this.
        """
        if self.params.get("lmodel") and self._tessdata is None:
            self.unpack_tessdata(self.params.get("lmodel"))

        # do convert stuff
        with tempfile.NamedTemporaryFile(suffix=".png") as t:
            t.close()
            iulib.write_image_binary(t.name, line)
            # annoying extra step 'cos tesseract only understands tiffs
            tiff = self.convert_to_tiff(t.name)
            text = self.process_line(tiff)
            os.unlink(tiff)
            return text            

    def convert_to_tiff(self, imagepath):
        with tempfile.NamedTemporaryFile(suffix=".tif") as t:
            t.close()
            retcode = sp.call(["convert", imagepath, t.name])
            if retcode == 0:
                os.unlink(imagepath)
                return t.name
            else:
                # TODO: handle this error somehow
                pass

    def unpack_tessdata(self, lmodelpath):
        # unpack tessdata files if given
        # might as well make this even less efficient!
        self.logger.info("Unpacking tessdata: %s" % lmodelpath)
        import tarfile, tempfile
        self._tessdata = tempfile.mkdtemp() + "/"
        os.mkdir(os.path.join(self._tessdata, "tessdata"))
        try:
            tgz = tarfile.open(lmodelpath, "r:*")
        except tarfile.ReadError, e:
            raise Exception("%s: %s" % (e.message, lmodelpath))
        self._lang = os.path.splitext(tgz.getnames()[0])[0]
        tgz.extractall(path=os.path.join(self._tessdata, "tessdata"))

        # set environ var where tesseract picks up the tessdata dir
        os.environ["TESSDATA_PREFIX"] = self._tessdata

    def process_line(self, imagepath, tesslang=None):
        lines = []
        with tempfile.NamedTemporaryFile() as t:
            t.close()
            tessargs = ["/usr/local/bin/tesseract", imagepath, t.name]
            if self._lang is not None:
                tessargs.extend(["-l", self._lang])                
            p = sp.Popen(tessargs, stderr=sp.PIPE)
            err = p.stderr.read()
            if p.wait() != 0:
                raise RuntimeError("tesseract failed with errno %d: %s" % (p.returncode, err))
            
            # read and delete Tesseract's temp text file
            # whilst writing to our file
            with open(t.name + ".txt", "r") as tf:
                lines = [line.rstrip() for line in tf.readlines()]
                if lines and lines[-1] == "":
                    lines = lines[:-1]
                os.unlink(tf.name)        
        return " ".join(lines)
    
    def __del__(self):
        # delete lmodeldir
        if self._tessdata and os.path.exists(self._tessdata):
            try:
                self.logger.info("Cleaning up temp tessdata folder: %s" % self._tessdata)
                shutil.rmtree(self._tessdata)
            except OSError, (errno, strerr):
                print("RmTree raised error: %s, %s" % (errno, strerr))

