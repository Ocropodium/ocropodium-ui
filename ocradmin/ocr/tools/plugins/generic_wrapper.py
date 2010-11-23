"""
Generic wrapper for tools that accept a single line image and
return a single line of text.
"""


import os
import tempfile
import iulib
import subprocess as sp
from ocradmin.ocr.tools import check_aborted, get_binary
from ocropus_wrapper import OcropusWrapper


class GenericWrapper(OcropusWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use generic OCRs for recognition of individual lines.
    """
    name = "generic"
    binary = "unimplemented"

    def get_command(self, *args, **kwargs):
        """
        Get the command line for converting a given image.
        """
        raise NotImplementedError


    @check_aborted
    def get_transcript(self, line):
        """
        Recognise each individual line by writing it as a temporary
        PNG and calling self.binary on the image.  
        """
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.close()
            iulib.write_image_binary(tmp.name, line)
            text = self.process_line(tmp.name)
            os.unlink(tmp.name)
            return text            


    @check_aborted
    def process_line(self, imagepath):
        """
        Run OCR on image, using YET ANOTHER temporary
        file to gather the output, which is then read back in. 
        """
        lines = []
        with tempfile.NamedTemporaryFile() as tmp:
            tmp.close()
            args = self.get_command(outfile=tmp.name, image=imagepath)
            if not os.path.exists(args[0]):
                raise ExternalToolError("Unable to find binary: '%s'" % args[0])
            self.logger.info(args)
            proc = sp.Popen(args, stderr=sp.PIPE)
            err = proc.stderr.read()
            if proc.wait() != 0:
                return "!!! %s CONVERSION ERROR %d: %s !!!" % (
                        os.path.basename(self.binary).upper(),
                        proc.returncode, err)
            
            # read and delete the temp text file
            # whilst writing to our file
            with open(tmp.name, "r") as txt:
                lines = [line.rstrip() for line in txt.readlines()]
                if lines and lines[-1] == "":
                    lines = lines[:-1]
                os.unlink(txt.name)        
        return " ".join(lines)




