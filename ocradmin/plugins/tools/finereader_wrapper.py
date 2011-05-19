"""
Wrapper for Abbyy Finereader 8.0 CLI.
"""


from ocradmin.plugins import base, check_aborted, get_binary, ExternalToolError, set_progress
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
            "name": "preprocessing",
            "description": "Preprocessing",
            "parameters": [{
                    "name": "no_deskew_correction",
                    "type": "bool",
                    "description": "Don't correct skew angle",
                    "value": False,
                }, {
                    "name": "invert_image",
                    "type": "bool",
                    "description": "Invert image on opening",                    
                    "value": False,
                }, {
                    "name": "mirror_image",
                    "type": "bool",
                    "description": "Mirror image on opening",
                    "value": False,
                }, {
                    "name": "no_despeckle",
                    "type": "bool",
                    "description": "Don't despeckle on opening",
                    "value": False,
                }, {
                    "name": "image_rotation",
                    "type": "scalar",
                    "description": "Rotate image on opening",
                    "value": "NoRotation",
                    "choices": [
                        { "name": "NoRotation", },
                        { "name": "Clockwise", },
                        { "name": "CounterClockwise", },
                    ],
                },                
            ],
        
        }, {
            "name": "image_analysis",
            "description": "Image Analysis Options",
            "parameters": [
                {
                    "name": "detect_inverted",
                    "description": "Detect inverted image",
                    "type": "bool",
                    "value": False,
                }, {
                    "name": "detect_orientation",
                    "description": "Detect image orientation",
                    "type": "bool",
                    "value": False,
                }, {
                    "name": "dont_detect_pictures",
                    "desciption": "Don't detect pictures",
                    "type": "bool",
                    "value": False,
                }, {
                    "name": "dont_detect_inverted",
                    "description": "Don't detect inverted image",
                    "type": "bool",
                    "value": False,
                }, {
                    "name": "dont_detect_tables",
                    "description": "Don't detect tables",
                    "type": "bool",
                    "value": False,
                },
            ],            
        }, {
            "name": "recogniser",
            "description": "Recogniser Options",
            "parameters": [
                {
                    "name": "balanced_mode",
                    "description": "Balanced Recognition Mode",
                    "type": "bool",
                    "value": False,
                }, {
                    "name": "fast_mode",
                    "description": "Fast Recognition Mode",
                    "type": "bool",
                    "value": False,
                }, {
                    "name": "case_mode",
                    "description": "Case Recognition Mode",
                    "type": "scalar",
                    "value": "AutoCase",
                    "choices": [
                        { "name": "AutoCase", },
                        { "name": "SmallCase", },
                        { "name": "CapitalCase", },
                    ],
                },
            ],
        }, {
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



