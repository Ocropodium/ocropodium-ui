"""
Cuneiform Recogniser
"""

from nodetree import node, manager
from ocradmin import plugins
from ocradmin.plugins import utils, stages, generic_nodes
from ocradmin.core import utils as ocrutils
import types

import os
import shutil
import tempfile
import subprocess as sp

NAME = "Abbyy"

class AbbyyRecognizerNode(generic_nodes.CommandLineRecognizerNode):
    """
    Recognize an image using Cuneiform.
    """
    name = "Abbyy::AbbyyRecognizer"
    description = "Abbyy Native Text Recognizer"
    binary = "abbyyocr"
    stage = stages.RECOGNIZE
    arity = 1

    def get_command(self, outfile, image):
        """
        Cuneiform command line.  Simplified for now.
        """
        return [self.binary, "-if", image, "-f", "XML", "-of", outfile] 

    def set_image_dpi(self, image):
        """
        Hack to set 300 PPI on all images.  This should hopefully
        prevent FR from using up thousands of pages of license
        if there's no resolution header available.
        """
        p = sp.Popen(["convert", "-units", "PixelsPerInch", 
                "-density", "300", image, image])
        return p.wait()

    def _eval(self):
        """
        Convert a full page.
        """
        binary = self.get_input_data(0)
        json = None
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.close()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as btmp:
                btmp.close()
                self.write_binary(btmp.name, binary)
                self.set_image_dpi(btmp.name)
                args = self.get_command(tmp.name, btmp.name)
                self.logger.debug("Running: '%s'", " ".join(args))
                proc = sp.Popen(args, stderr=sp.PIPE)
                err = proc.stderr.read()
                if proc.wait() != 0:
                    return "!!! %s CONVERSION ERROR %d: %s !!!" % (
                            os.path.basename(self.binary).upper(),
                            proc.returncode, err)
                json = ocrutils.FinereaderXmlParser().parsefile(tmp.name)
            os.unlink(tmp.name)
            os.unlink(btmp.name)
        plugins.set_progress(self.logger, self.progress_func, 100, 100)
        return utils.hocr_from_data(json)


class Manager(manager.StandardManager):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        if name == "AbbyyRecognizer":
            return AbbyyRecognizerNode(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())

if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n


