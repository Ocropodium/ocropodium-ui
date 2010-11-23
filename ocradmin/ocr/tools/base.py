

class OcrBase(object):
    """
    Abstract Base Class for an OCR tool.
    """
    name = "base"
    capabilities = []

    def __init__(self):
        """
        Initialise a base OCR converter.
        """
        pass


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


