"""
Cuneiform Recogniser
"""

from nodetree import node, manager
from ocradmin import plugins
from ocradmin.plugins import stages, generic_nodes
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

    def _eval(self):
        """
        Convert a full page.
        """
        from ocradmin.core.utils import FinereaderXmlParser
        binary = self.get_input_data(0)
        json = None
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.close()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as btmp:
                btmp.close()
                self.write_binary(btmp.name, binary)
                args = self.get_command(tmp.name, btmp.name)
                self.logger.debug("Running: '%s'", " ".join(args))
                proc = sp.Popen(args, stderr=sp.PIPE)
                err = proc.stderr.read()
                if proc.wait() != 0:
                    return "!!! %s CONVERSION ERROR %d: %s !!!" % (
                            os.path.basename(self.binary).upper(),
                            proc.returncode, err)
                json = FinereaderXmlParser().parsefile(tmp.name)
            #os.unlink(tmp.name)
            #os.unlink(btmp.name)
        plugins.set_progress(self.logger, self.progress_func, 100, 100)
        return json   


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


