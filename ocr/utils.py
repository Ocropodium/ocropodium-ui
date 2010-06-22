
import os
from datetime import datetime
import shutil
import tempfile
import subprocess as sp
from django.conf import settings


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




class TessWrapper(object):
    def __init__(self, logger):
        self._tessdata = None
        self._lang = None
        self.logger = logger


    def __call__(self, linerec, lmodel, line):
        """
        linerec is a dummy param so we can plug this class in and
        call it as a get_transcript function in place of the ocropus
        one.  TODO: Fix this.
        """
        if lmodel and self._tessdata is None:
            self.unpack_tessdata(lmodel)

        # do convert stuff
        import iulib
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

