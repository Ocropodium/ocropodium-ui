"""
Wrapper for GOCR.
"""

import generic_wrapper
#reload(generic_wrapper)

import gocr_options
#reload(gocr_options)


def main_class():
    return GocrWrapper


class GocrWrapper(generic_wrapper.GenericWrapper, 
            gocr_options.GocrOptions):
    """
    Override certain methods of the OcropusWrapper to
    use Gocr for recognition of individual lines.
    """
    name = "gocr"
    description = "Wrapper for GNU GOCR"
    binary = generic_wrapper.get_binary("gocr")

    def get_command(self, outfile, image):
        """
        GOCR command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, "-i", image] 


                

