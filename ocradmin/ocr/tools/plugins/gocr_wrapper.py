"""
Wrapper for GOCR.
"""



from generic_wrapper import *


def main_class():
    return GocrWrapper


class GocrWrapper(GenericWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Gocr for recognition of individual lines.
    """
    name = "gocr"
    description = "Wrapper for GNU GOCR"
    binary = get_binary("gocr")
    _parameters = []

    def get_command(self, outfile, image):
        """
        GOCR command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, "-i", image] 


                

