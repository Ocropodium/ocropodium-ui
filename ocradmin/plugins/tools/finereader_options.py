
import ocr_options
#reload(generic_options)

from ocradmin.ocrmodels.models import OcrModel

class FinereaderOptions(ocr_options.OcrOptions):
    """
    Finereader options.
    """
    name = "finereader"

    @classmethod
    def get_general_preprocessing_parameters(cls):
        params = super(FinereaderOptions, cls).get_general_preprocessing_parameters()        
        return params + [{
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
            }, {
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
        ]

    @classmethod    
    def get_recognition_parameters(cls):
        """
        Finereader recognition params.
        """
        params = super(FinereaderOptions, cls).get_recognition_parameters()        
        return params + [{
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
        ]

    @classmethod
    def get_page_segmenters(cls):
        """
        Finereader segmentation options.
        """
        params = super(FinereaderOptions, cls).get_recognition_parameters()        
        return params + [{
                "name": "single",
                "description": "Single Column",
                "value": 0,
            }, {
                "name": "default",
                "description": "Auto Detection",
                "value": 1,
            },
        ]
        


