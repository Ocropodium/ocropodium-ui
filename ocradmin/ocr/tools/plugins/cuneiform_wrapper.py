"""
Wrapper for Cuneiform.
"""



from generic_wrapper import *

def main_class():
    return CuneiformWrapper

class CuneiformWrapper(GenericWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Cuneiform for recognition of individual lines.
    """
    name = "cuneiform"
    capabilities = ("line", "page")
    binary = get_binary("cuneiform")

    def get_command(self, outfile, image):
        """
        Cuneiform command line.  Simplified for now.
        """
        return [self.binary, "-o", outfile, image] 



