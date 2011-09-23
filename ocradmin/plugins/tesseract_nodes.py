"""
Tesseract Recogniser
"""

from nodetree import node, manager
from ocradmin import plugins
from ocradmin.plugins import stages, generic_nodes

import os
import shutil
import tempfile
import subprocess as sp

from ocradmin.ocrmodels.models import OcrModel


NAME = "Tesseract"

class TesseractRecognizerNode(generic_nodes.CommandLineRecognizerNode):
    """
    Recognize an image using Tesseract.
    """
    name = "Tesseract::TesseractRecognizer"
    description = "Tesseract Native Text Recognizer"
    stage = stages.RECOGNIZE
    binary = "tesseract"
    _parameters = []

    def __init__(self, *args, **kwargs):
        self._parameters = [
            dict(
                name="language_model",
                value="Tesseract Default Lang",
                choices=[m.name for m in \
                        OcrModel.objects.filter(app="tesseract", type="lang")],
            )
        ]
        super(self.__class__, self).__init__(*args, **kwargs)


    def _validate(self):
        """
        Check we're in a good state.
        """
        super(TesseractRecognizerNode, self)._validate()
        if self._params.get("language_model", "").strip() == "":
            raise node.ValidationError(self, "no language model given: %s" % self._params)

    def init_converter(self):
        """
        Extract the lmodel to a temporary directory.  This is
        cleaned up in the destructor.
        """
        if not hasattr(self, "_tessdata") is None:
            modpath = plugins.lookup_model_file(self._params["language_model"])
            self.unpack_tessdata(modpath)
        self._tesseract = plugins.get_binary("tesseract")
        self.logger.debug("Using Tesseract: %s" % self._tesseract)

    @plugins.check_aborted
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
            tiff = plugins.convert_to_temp_image(tmp.name, "tif")
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
        self.logger.debug("Unpacking tessdata: %s" % lmodelpath)
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

    @plugins.check_aborted
    def process_line(self, imagepath):
        """
        Run Tesseract on the TIFF image, using YET ANOTHER temporary
        file to gather the output, which is then read back in.  If
        you think this seems horribly inefficient you'd be right, but
        Tesseract's external interface is quite inflexible.
        TODO: Fix hardcoded path to Tesseract.
        """
        if not hasattr(self, "_tessdata"):
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
        if hasattr(self, "_tessdata") and os.path.exists(self._tessdata):
            try:
                self.logger.debug(
                    "Cleaning up temp tessdata folder: %s" % self._tessdata)
                shutil.rmtree(self._tessdata)
            except OSError, (errno, strerr):
                self.logger.error(
                    "RmTree raised error: %s, %s" % (errno, strerr))


class Manager(manager.StandardManager):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        g = globals()
        if g.get(name + "Node"):            
            return g.get(name + "Node")(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())


if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n



