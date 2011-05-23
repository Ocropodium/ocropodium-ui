"""
Apply a processing tree for a full OCR pipeline.
"""

import ocropus_stages
import tesseract_stages

class OcrPipeline(object):
    """
    Object describing the OCR pipeline.
    """
    def __init__(self, tree):
        """
        Initialiser.
        """
        self._tree = tree
    
    def get_grayscale_stages(self):
        """
        Get grayscale preprocessors.
        """
        return self._tree.get("grayscale_filters", [])

    def get_binary_stages(self):
        """
        Get binary preprocessors.
        """
        return self._tree.get("binary_filters", [])

    def get_binarizer(self):
        """
        Get the binarizer component.
        """
        return self._tree.get("binarizer")

    def get_page_segmenter(self):
        """
        Get page segmenter.
        """
        return self._tree.get("page_segmenter")

    def get_recognizer(self):
        """
        Get the recogniser component.
        """
        return self._tree.get("recognizer")


def apply_stage(input, stage):
    """
    Apply a single stage.
    """
    mod, name = stage["name"].split("::")
    #reload(ocropus_stages)
    reload(tesseract_stages)
    s = None    
    if mod == "Ocropus":
        s = ocropus_stages.OcropusModule.get_stage(name)
    elif mod == "Tesseract":
        s = tesseract_stages.TesseractModule.get_stage(name)
    for p, v in stage["params"]:
        s.set_param(p, v)
    return s.eval(input)


def apply_tree(input, tree):
    """
    Apply a tree of stages for the full OCR pipeline.
    """
    gray = reduce(
            apply_stage, list(tree.get_grayscale_stages()), input)
    rawbin = apply_stage(input, tree.get_binarizer())
    binary = reduce(
            apply_stage, list(tree.get_binary_stages()), rawbin)
    boxes = apply_stage(binary, tree.get_page_segmenter())
    return apply_stage((binary, boxes), tree.get_recognizer())


TESTTREE = {
    "grayscale_filters": [
    ],
    "binary_filters": [
        {
            "name": "Ocropus::DeskewPageByRAST",
            "params": [
                ("max_n", 10000),
            ]
        }, {
            "name": "Ocropus::RmHalftone",
            "params": [
                ("factor", 3),
                ("threshold", 4)
            ]
        }
    ],
    "binarizer": {
        "name": "Ocropus::BinarizeBySauvola",
        "params": [
            ("k", 0.3),
            ("w", 40),
        ]
    },
    "page_segmenter": {
        "name": "Ocropus::SegmentPageByRAST",
        "params": [
            ("all_pixels", 0),
            ("gap_factor", 10),
        ]
    },
    "recognizer": {
        "name": "Tesseract::NativeRecognizer",
        "params": [
            ("character_model", "Ocropus Default Char"),
            ("language_model", "Default Tesseract English"),
        ]
    }
}


def test(*args):
    import ocrolib
    for f in args:
        ia = ocrolib.iulib.bytearray()
        ocrolib.iulib.read_image_gray(ia, f)
        doc = apply_tree(ocrolib.narray2numpy(ia), OcrPipeline(TESTTREE))
        for line in doc["lines"]:
            print line["text"]



if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        test(sys.argv[1:])



