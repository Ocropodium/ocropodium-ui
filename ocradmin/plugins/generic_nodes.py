"""
Generic base classes for other nodes.
"""

import os
import json
from ocradmin import plugins
from ocradmin.plugins import stages
from nodetree import node, writable_node
import ocrolib

class ExternalToolError(StandardError):
    pass


class JSONWriterMixin(writable_node.WritableNodeMixin):
    """
    Functions for reading and writing a node's data in JSON format.
    """
    extension = ".json"

    @classmethod
    def reader(cls, path):
        """Read a cache from a given dir."""
        if os.path.exists(path):
            with open(path, "r") as fh:
                return json.load(fh)

    @classmethod
    def writer(cls, path, data):
        """Write a cache from a given dir."""
        with open(path, "w") as fh:
            json.dump(data, fh)
        return path            


class PngWriterMixin(writable_node.WritableNodeMixin):
    """
    Object which writes/reads a PNG.
    """
    extension = ".png"


class BinaryPngWriterMixin(PngWriterMixin):
    """
    Functions for reading and writing a node's data in binary PNG.
    """
    @classmethod
    def reader(cls, path):
        if os.path.exists(path):
            return ocrolib.read_image_gray(path)

    @classmethod
    def writer(cls, path, data):
        ocrolib.write_image_gray(path, data)
        return path


class ColorPngWriterMixin(PngWriterMixin):
    """
    Functions for reading and writing a node's data in binary PNG.
    """
    @classmethod
    def reader(cls, path):
        if os.path.exists(path):
            packed = ocrolib.iulib.intarray()
            ocrolib.iulib.read_image_packed(packed, path)
            return ocrolib.narray2numpy(packed)

    @classmethod
    def writer(cls, path, data):
        packed = ocrolib.numpy2narray(data)
        ocrolib.iulib.write_image_packed(
                path, ocrolib.pseg2narray(data))
        return path


class GrayPngWriterMixin(BinaryPngWriterMixin):
    """
    Functions for reading and writing a node's data in binary PNG.
    """
    pass


class LineRecognizerNode(node.Node, JSONWriterMixin):
    """
    Node which takes a binary and a segmentation and
    recognises text one line at a time.
    """
    stage = stages.RECOGNIZE
    arity = 2
    passthrough = 1

    def init_converter(self):
        raise NotImplementedError

    def get_transcript(self):
        raise NotImplementedError

    def _validate(self):
        """
        Check state of the inputs.
        """
        self.logger.debug("%s: validating...", self)
        super(LineRecognizerNode, self)._validate()
        for i in range(len(self._inputs)):
            if self._inputs[i] is None:
                raise node.ValidationError(self, "missing input '%d'" % i)

    def _eval(self):
        """
        Recognize page text.

        input: tuple of binary, input boxes
        return: page data
        """
        binary = self.get_input_data(0)
        boxes = self.get_input_data(1)
        pageheight, pagewidth = binary.shape
        iulibbin = ocrolib.numpy2narray(binary)
        out = dict(
                lines=[],
                box=[0, 0, pagewidth, pageheight],
        )
        numlines = len(boxes.get("lines", []))
        for i in range(numlines):
            set_progress(self.logger, self.progress_func, i, numlines)
            coords = boxes.get("lines")[i]
            iulibcoords = (
                coords[0], pageheight - coords[1], coords[0] + coords[2],
                pageheight - (coords[1] - coords[3]))
            lineimage = ocrolib.iulib.bytearray()
            ocrolib.iulib.extract_subimage(lineimage, iulibbin, *iulibcoords)
            out["lines"].append(dict(
                    box=coords,
                    text=self.get_transcript(ocrolib.narray2numpy(lineimage)),
            ))
        set_progress(self.logger, self.progress_func, numlines, numlines)
        return out

def set_progress(logger, progress_func, step, end, granularity=5):
    """
    Call a progress function, if supplied.  Only call
    every 5 steps.  Also set the total todo, i.e. the
    number of lines to process.
    """
    if progress_func is None:
        return
    if not (step and end):
        return
    if step != end and step % granularity != 0:
        return
    perc = min(100.0, round(float(step) / float(end), 2) * 100)
    progress_func(perc, end)    


class CommandLineRecognizerNode(LineRecognizerNode):
    """
    Generic recogniser based on a command line tool.
    """
    binary = "unimplemented"

    def _validate(self):
        super(CommandLineRecognizerNode, self)._validate()

    def get_command(self, *args, **kwargs):
        """
        Get the command line for converting a given image.
        """
        raise NotImplementedError

    @classmethod
    def write_binary(cls, path, data):
        """
        Write a binary image.
        """
        ocrolib.iulib.write_image_binary(path, ocrolib.numpy2narray(data))

    @classmethod
    def write_packed(cls, path, data):
        """
        Write a packed image.
        """
        ocrolib.iulib.write_image_packed(path, ocrolib.pseg2narray(data))

    @plugins.check_aborted
    def get_transcript(self, line):
        """
        Recognise each individual line by writing it as a temporary
        PNG and calling self.binary on the image.
        """
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.close()
            self.write_binary(tmp.name, line)
            text = self.process_line(tmp.name)
            os.unlink(tmp.name)
            return text

    @plugins.check_aborted
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


class ImageGeneratorNode(node.Node):
    """
    Node which takes no input and returns an image.
    """
    arity = 0

    def null_data(self):
        """
        Return an empty numpy image.
        """
        return ocrolib.numpy.zeros((640,480,3), dtype=ocrolib.numpy.uint8)


class FileNode(node.Node, GrayPngWriterMixin):
    """
    Node which reads or writes to a file path.
    """
    def _validate(self):
        super(FileNode, self)._validate()
        if self._params.get("path") is None:
            raise node.ValidationError(self, "'path' not set")
        if not os.path.exists(self._params.get("path", "")):
            raise node.ValidationError(self, "'path': file not found")


