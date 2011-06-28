"""
Cuneiform Recogniser
"""

from nodetree import node, manager
from ocradmin import plugins
from ocradmin.plugins import stages, generic_nodes
import types

import os
import codecs
import shutil
import tempfile
import subprocess as sp

NAME = "Cuneiform"

class CuneiformRecognizerNode(generic_nodes.CommandLineRecognizerNode):
    """
    Recognize an image using Cuneiform.
    """
    name = "Cuneiform::CuneiformRecognizer"
    description = "Cuneiform Native Text Recognizer"
    binary = "cuneiform"
    stage = stages.RECOGNIZE
    arity = 1
    _parameters = [
            dict(name="single_column", type="bool", value=False)
    ]

    def get_command(self, outfile, image):
        """
        Cuneiform command line.  Simplified for now.
        """
        args = [self.binary, "-o", outfile]
        if self._params.get("single_column", False):
            args.extend(["--singlecolumn"])
        return args + [image]

    def _eval(self):
        """
        Convert a full page.
        """
        binary = self.get_input_data(0)
        hocr = None
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.close()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as btmp:
                btmp.close()
                self.write_binary(btmp.name, binary)
                args = [self.binary, "-f", "hocr", "-o", tmp.name, btmp.name]
                self.logger.debug("Running: '%s'", " ".join(args))
                proc = sp.Popen(args, stderr=sp.PIPE)
                err = proc.stderr.read()
                if proc.wait() != 0:
                    return "!!! %s CONVERSION ERROR %d: %s !!!" % (
                            os.path.basename(self.binary).upper(),
                            proc.returncode, err)
                with codecs.open(tmp.name, "r", "utf8") as tread:
                    hocr = tread.read()
            os.unlink(tmp.name)
            os.unlink(btmp.name)
        plugins.set_progress(self.logger, self.progress_func, 100, 100)
        return hocr


class Manager(manager.StandardManager):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        if name == "CuneiformRecognizer":
            return CuneiformRecognizerNode(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())

if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n


