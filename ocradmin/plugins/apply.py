"""
Apply a processing tree for a full OCR pipeline.
"""

import ocropus_nodes
import tesseract_nodes
import cuneiform_nodes

class OcrPipeline(object):
    """
    Object describing the OCR pipeline.
    """
    def __init__(self, tree):
        """
        Initialiser.
        """
        self._tree = tree
    
    def get_grayscale_nodes(self):
        """
        Get grayscale preprocessors.
        """
        return self._tree.get("grayscale_filters", [])

    def get_binary_nodes(self):
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


def apply_node(input, node):
    """
    Apply a single node.
    """
    mod, name = node["name"].split("::")
    #reload(ocropus_nodes)
    reload(cuneiform_nodes)
    reload(tesseract_nodes)
    s = None    
    if mod == "Ocropus":
        s = ocropus_nodes.OcropusModule.get_node(name)
    elif mod == "Tesseract":
        s = tesseract_nodes.TesseractModule.get_node(name)
    elif mod == "Cuneiform":
        s = cuneiform_nodes.CuneiformModule.get_node(name)
    for p, v in node["params"]:
        s.set_param(p, v)
    return s.eval(input)


def apply_tree(input, tree):
    """
    Apply a tree of nodes for the full OCR pipeline.
    """
    gray = reduce(
            apply_node, list(tree.get_grayscale_nodes()), input)
    rawbin = apply_node(input, tree.get_binarizer())
    binary = reduce(
            apply_node, list(tree.get_binary_nodes()), rawbin)
    boxes = apply_node(binary, tree.get_page_segmenter())
    return apply_node((binary, boxes), tree.get_recognizer())


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
}

TESTTREE_OCROPUS = {
    "recognizer": {
        "name": "Ocropus::NativeRecognizer",
        "params": [
            ("character_model", "Ocropus Default Char"),
            ("language_model", "Ocropus Default Lang"),
        ]
    }
}

TESTTREE_TESSERACT = {
    "recognizer": {
        "name": "Tesseract::NativeRecognizer",
        "params": [
            ("language_model", "Tesseract Default Lang"),
        ]
    }
}

TESTTREE_CUNEIFORM = {
    "recognizer": {
        "name": "Cuneiform::NativeRecognizer",
        "params": [
        ]
    }
}


def test(*args, **kwargs):
    tree = kwargs.get("tree", TESTTREE)
    import ocrolib
    for f in args:
        ia = ocrolib.iulib.bytearray()
        ocrolib.iulib.read_image_gray(ia, f)
        doc = apply_tree(ocrolib.narray2numpy(ia), OcrPipeline(tree))
        for line in doc["lines"]:
            print line["text"]

def test_ocropus(*args):
    tree = TESTTREE
    tree.update(TESTTREE_OCROPUS)
    test(*args, tree=tree)

def test_tesseract(*args):
    tree = TESTTREE
    tree.update(TESTTREE_TESSERACT)
    test(*args, tree=tree)

def test_cuneiform(*args):
    tree = TESTTREE
    tree.update(TESTTREE_CUNEIFORM)
    test(*args, tree=tree)



if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        test(sys.argv[1:])



