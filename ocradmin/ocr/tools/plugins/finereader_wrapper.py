"""
Wrapper for Abbyy Finereader 8.0 CLI.
"""



from generic_wrapper import *


def main_class():
    return FinereaderWrapper


class FinereaderWrapper(GenericWrapper):
    """
    Override certain methods of the OcropusWrapper to
    use Abbyy FR for recognition of individual lines.
    """
    name = "finereader"
    description = "Wrapper for Abbyy Finereader CLI 8.0"
    capabilities = ("page",)
    binary = get_binary("abbyyocr")
    parameters = [
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

    def get_command(self, outfile, image):
        """
        FR command line.  Simplified for now.
        """
        return [self.binary, "-if", image, "-of", outfile] 



