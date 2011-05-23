"""
OCR tool wrappers and utilities.
"""

import os
import subprocess as sp
import tempfile

from ocradmin.ocrmodels.models import OcrModel


class NoSuchNodeException(StandardError):
    pass


class UnknownOcropusNodeType(StandardError):
    pass


class ExternalToolError(StandardError):
    """
    Errors with external command-line tools etc.
    """
    pass


class AbortedAction(StandardError):
    """
    Exception to raise when execution is aborted.
    """
    pass


def lookup_model_file(modelname):
    """
    Lookup the filename of a model from its
    database name.
    """
    mod = OcrModel.objects.get(name=modelname)
    return mod.file.path.encode()


def get_binary(binname):
    """
    Try and find where Tesseract is installed.
    """
    bin = sp.Popen(["which", binname], 
            stdout=sp.PIPE).communicate()[0].strip()
    if bin and os.path.exists(bin):
        return bin

    for path in ["/usr/local/bin", "/usr/bin"]:
        binpath = os.path.join(path, binname) 
        if os.path.exists(binpath):
            return binpath
    # fallback...
    return binname


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


def check_aborted(method):
    def wrapper(*args, **kwargs):
        instance = args[0]
        if instance.abort_func is not None:
            if instance.abort_func():
                instance.logger.warning("Aborted")
                raise AbortedAction(method.func_name)
        return method(*args, **kwargs)
    return wrapper


def convert_to_temp_image(imagepath, suffix="tif"):
    """
    Convert PNG to TIFF with GraphicsMagick.  This seems
    more reliable than PIL, which seems to have problems
    with Group4 TIFF encoders.
    """
    with tempfile.NamedTemporaryFile(suffix=".%s" % suffix) as tmp:
        tmp.close()
        retcode = sp.call(["convert", imagepath, tmp.name])
        if not retcode == 0:
            raise ExternalToolError(
                "convert failed to create TIFF file with errno %d" % retcode) 
        return tmp.name



