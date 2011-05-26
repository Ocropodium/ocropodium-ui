"""
Cuneiform Recogniser
"""

import plugins
import manager
import node
import stages
import generic_nodes
import types

import os
import shutil
import tempfile
import subprocess as sp


class CuneiformRecognizerNode(generic_nodes.CommandLineRecognizerNode):
    """
    Recognize an image using Cuneiform.
    """
    name = "Cuneiform::CuneiformRecognizer"
    description = "Cuneiform Native Text Recognizer"
    binary = "cuneiform"
    stage = stages.RECOGNIZE
    arity = 1

    def get_command(self, outfile, image):
        """
        Cuneiform command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, image] 

    def eval(self):
        """
        Convert a full page.
        """
        from ocradmin.core.utils import HocrParser
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


