"""
Wrapper for Cuneiform.
"""


import tempfile
import subprocess as sp
from ocradmin.plugins import check_aborted, set_progress
from ocradmin.core.utils import HocrParser
from generic_wrapper import *


def main_class():
    return CuneiformWrapper

class CuneiformWrapper(GenericWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Cuneiform for recognition of individual lines.
    """
    name = "cuneiform"
    description = "Wrapper for Cuneiform Linux"
    capabilities = ("line", "page")
    binary = get_binary("cuneiform")

    def get_command(self, outfile, image):
        """
        Cuneiform command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, image] 


    def convert(self, filepath, *args, **kwargs):
        """
        Convert a full page.
        """
        json = None
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.close()
            args = [self.binary, "-f", "hocr", "-o", tmp.name, filepath]
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
        set_progress(self.logger, kwargs["progress_func"], 100, 100)
        return json            

