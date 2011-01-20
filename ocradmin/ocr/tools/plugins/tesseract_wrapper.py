

import os
import tempfile
import shutil
import subprocess as sp
from ocradmin.ocr.tools import check_aborted, set_progress, convert_to_temp_image, get_binary
from ocropus_wrapper import OcropusWrapper


def main_class():
    return TesseractWrapper


class TesseractWrapper(OcropusWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Tesseract for recognition of individual lines.
    """
    name = "tesseract"
    capabilities = ["line"]

    def __init__(self, *args, **kwargs):
        """
        Initialise a TesseractWrapper object.
        """
        self._tessdata = None
        self._lang = None
        self._tesseract = None
        super(TesseractWrapper, self).__init__(*args, **kwargs)


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
            self.write_binary(tmp.name, line)
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
                return "!!! TESSERACT CONVERSION ERROR %d: %s !!!" % (proc.returncode, err)
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


