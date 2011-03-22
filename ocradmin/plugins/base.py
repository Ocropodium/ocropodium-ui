
import logging

class OcrBase(object):
    """
    Abstract Base Class for an OCR tool.
    """
    name = "base"
    description = "Base OCR wrapper class"
    options = None
    capabilities = []

    def __init__(self, *args, **kwargs):
        """
        Initialise a base OCR converter.
        """
        pass


    def get_default_logger(self):
        """
        Initialize a default logger to stderr.
        """
        logging.basicConfig(level=logging.DEBUG)
        return logging.getLogger(self.__class__.__name__)


    @classmethod
    def get_parameters(cls, *args, **kwargs):
        """
        Get general options.
        """
        raise NotImplementedError


    def convert(self, *args, **kwargs):
        """
        Convert an image file.
        """
        raise NotImplementedError


    def train(self, *args, **kwargs):
        """
        Train a new model.
        """
        raise NotImplementedError


    def get_transcript(self, *args, **kwargs):
        """
        Convert a single line image and
        return a single line of text.
        """
        raise NotImplementedError


    def get_page_binary(self, *args, **kwargs):
        """
        Convert an on-disk file into an in-memory iulib.bytearray.
        """
        raise NotImplementedError


    def get_page_seg(self, *args, **kwargs):
        """
        Segment the binary page into a colour-coded segmented images.
        """
        raise NotImplementedError


    @classmethod
    def get_info(cls, *args, **kwargs):
        """
        Get info for a given plugin.
        """
        return """Hello, this is %s.  
    Welcome to today's scheduled programming.""" % cls.name

