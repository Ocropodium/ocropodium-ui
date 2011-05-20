"""
Wrapper for Abbyy Finereader 8.0 CLI.
"""


from ocradmin.plugins import base, check_aborted, get_binary, ExternalToolError, set_progress
import generic_wrapper
import finereader_options

def main_class():
    return FinereaderWrapper


class FinereaderWrapper(generic_wrapper.GenericWrapper,
            finereader_options.FinereaderOptions):
    """
    Override certain methods of the OcropusWrapper to
    use Abbyy FR for recognition of individual lines.
    """
    name = "finereader"
    description = "Wrapper for Abbyy Finereader CLI 8.0"
    binary = generic_wrapper.get_binary("abbyyocr")

    def get_command(self, outfile, image):
        """
        FR command line.  Simplified for now.
        """
        return [self.binary, "-if", image, "-of", outfile] 



