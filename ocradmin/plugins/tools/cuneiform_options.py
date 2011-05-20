
import generic_options
#reload(generic_options)

from ocradmin.ocrmodels.models import OcrModel

class CuneiformOptions(generic_options.GenericOptions):
    """
    Cuneiform options.
    """
    name = "cuneiform"

    @classmethod            
    def get_recognition_parameters(cls):
        """
        Tesseract recognition options.
        """
        p = super(CuneiformOptions, cls)
        print "PARENT: %s" % p
        return p.get_recognition_parameters()
            

