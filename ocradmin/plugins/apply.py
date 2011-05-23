"""
Apply a processing tree for a full OCR pipeline.
"""

import node
reload(node)
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


TESTTREE = [
        {
            "name": "filein",
            "type": "Ocropus::FileIn",
            "params": [
                ("path", "etc/simple.png"),
            ],
            "inputs": [],
        }, {
            "name": "DeskewPageByRAST",
            "type": "Ocropus::DeskewPageByRAST",
            "params": [
                ("max_n", 10000),
            ],
            "inputs": ["BinarizeBySauvola"]
        }, {
            "name": "RmHalftone",
            "type": "Ocropus::RmHalftone",
            "params": [
                ("factor", 3),
                ("threshold", 4)
            ],
            "inputs": ["DeskewPageByRAST"]
        }, {
        "name": "BinarizeBySauvola",
        "type": "Ocropus::BinarizeBySauvola",
        "params": [
            ("k", 0.3),
            ("w", 40),
        ],
        "inputs": ["filein"]
    }, {
        "name": "SegmentPageByRAST",
        "type": "Ocropus::SegmentPageByRAST",
        "params": [
            ("all_pixels", 0),
            ("gap_factor", 10),
        ],
        "inputs": ["RmHalftone"]
    },
]

TESTTREE_OCROPUS = [
    {
        "name": "NativeRecognizer",
        "type": "Ocropus::NativeRecognizer",
        "params": [
            ("character_model", "Ocropus Default Char"),
            ("language_model", "Ocropus Default Lang"),
        ],
        "inputs": ["RmHalftone", "SegmentPageByRAST"]
    }
]

TESTTREE_TESSERACT = [
    {
        "name": "NativeRecognizer",
        "type": "Tesseract::NativeRecognizer",
        "params": [
            ("language_model", "Tesseract Default Lang"),
        ],
        "inputs": ["RmHalftone", "SegmentPageByRAST"]
    }
]

TESTTREE_CUNEIFORM = [
    {
        "name": "NativeRecognizer",
        "type": "Cuneiform::NativeRecognizer",
        "params": [
        ],
        "inputs": ["RmHalftone",]
    }
]

def get_node(type, params):
    reload(node)
    mod, name = type.split("::")
    reload(cuneiform_nodes)
    reload(tesseract_nodes)
    s = None    
    if mod == "Ocropus":
        s = ocropus_nodes.OcropusModule.get_node(name)
    elif mod == "Tesseract":
        s = tesseract_nodes.TesseractModule.get_node(name)
    elif mod == "Cuneiform":
        s = cuneiform_nodes.CuneiformModule.get_node(name)
    for p, v in params:
        s.set_param(p, v)
    return s



def test_dag(tree):
    d = {}
    s = {}
    for n in tree:
        if d.get(n["name"]):
            raise ValueError("Duplicate node in tree: %s" % n["name"])
        s[n["name"]] = n
        node = get_node(n["type"], n["params"])
        d[n["name"]] = node
    for name, n in s.iteritems():
        for i in range(len(s[name]["inputs"])):            
            d[name].set_input(i, d[s[name]["inputs"][i]])
    base = d[tree[-1]["name"]]
    return base.eval()





def test(files, tree):
    import copy
    for f in files:
        tnew = copy.deepcopy(tree)
        for n in tnew:
            if n["name"] == "filein":
                for p in n["params"]:
                    if p[0] == "path":
                        p = ("path", f)
        doc = test_dag(tnew)
        for line in doc["lines"]:
            print line["text"]

def test_ocropus(*files):
    tree = TESTTREE
    tree.extend(TESTTREE_OCROPUS)
    test(files, tree)

def test_tesseract(*files):
    tree = TESTTREE
    tree.extend(TESTTREE_TESSERACT)
    test(files, tree)

def test_cuneiform(*files):
    tree = TESTTREE
    tree.extend(TESTTREE_CUNEIFORM)
    test(files, tree)



if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        test(sys.argv[1:])



