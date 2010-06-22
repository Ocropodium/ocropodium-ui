# Random useful functions.


def get_ocropus_model_info(path):
    """
        Get the info about an ocropus model/
    """
    proc = sp.Popen(["ocropus", "cinfo", path], stdout=sp.PIPE)
    return proc.stdout.read()


def get_tesseract_model_info(path):
    """
        Get info about Tesseract models.
    """

    return ""

