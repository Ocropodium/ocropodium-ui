"""
Tesseract Recogniser
"""

import plugins
import node
reload(node)
import generic_nodes

import os
import shutil
import tempfile
import subprocess as sp
from ocradmin.core.utils import HocrParser


class CuneiformRecognizerNode(generic_nodes.CommandLineRecognizerNode):
    """
    Recognize an image using Cuneiform.
    """
    _name = "CuneiformNativeRecognizer"
    _desc = "Cuneiform Native Text Recognizer"
    binary = "cuneiform"
    _arity = 1

    def get_command(self, outfile, image):
        """
        Cuneiform command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, image] 

    def eval(self):
        """
        Convert a full page.
        """
        binary = self.eval_input(0)
        json = None
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.close()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as btmp:
                btmp.close()
                self.write_binary(btmp.name, binary)
                args = [self.binary, "-f", "hocr", "-o", tmp.name, btmp.name]
                self.logger.info(args)
                proc = sp.Popen(args, stderr=sp.PIPE)
                err = proc.stderr.read()
                if proc.wait() != 0:
                    return "!!! %s CONVERSION ERROR %d: %s !!!" % (
                            os.path.basename(self.binary).upper(),
                            proc.returncode, err)
                json = HocrParser().parsefile(tmp.name)
                self.logger.info("%s" % json)
            os.unlink(tmp.name)
            os.unlink(btmp.name)
        plugins.set_progress(self.logger, self.progress_func, 100, 100)
        return json   


class CuneiformModule(object):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name):
        if name == "NativeRecognizer":
            return CuneiformRecognizerNode()

