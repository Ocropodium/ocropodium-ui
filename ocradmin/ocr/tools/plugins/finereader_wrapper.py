"""
Wrapper for Abbyy Finereader 8.0 CLI.
"""


from ocradmin.ocr.tools import base, check_aborted, get_binary, ExternalToolError, set_progress
import generic_wrapper
import copy

def main_class():
    return FinereaderWrapper


class FinereaderWrapper(generic_wrapper.GenericWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Abbyy FR for recognition of individual lines.
    """
    name = "finereader"
    description = "Wrapper for Abbyy Finereader CLI 8.0"
    capabilities = ("page",)
    binary = get_binary("abbyyocr")
    _parameters = [
        {
            "name": "page_segmentation",
            "description": "Page Segmentation Options",
            "choices": [
                {
                    "name": "single",
                    "description": "Single Column",
                    "value": 0,
                }, {
                    "name": "default",
                    "description": "Auto Detection",
                    "value": 1,
                },
            ],
        },
    ]

    @classmethod
    def parameters(cls):
        return cls._parameters


    def get_command(self, outfile, image):
        """
        FR command line.  Simplified for now.
        """
        return [self.binary, "-if", image, "-of", outfile] 



