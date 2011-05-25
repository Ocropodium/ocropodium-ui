"""
Apply a processing tree for a full OCR pipeline.
"""

import os
import sys
import copy
sys.path.append(os.path.abspath(".."))
os.environ['DJANGO_SETTINGS_MODULE'] = 'ocradmin.settings'


import node
import manager

class OcrPipeline(object):
    """
    Object describing the OCR pipeline.
    """
    def __init__(self, script, logger=None):
        """
        Initialiser.
        """
        self.logger = logger
        self._script = script
        self._error = None
        self._tree = {}
        self._manager = manager.ModuleManager()
        self._build_tree()

    def _build_tree(self):
        """
        Wire up the nodes in tree order.
        """
        lookup = {}
        for n in self._script:
            if self._tree.get(n["name"]):
                raise ValueError("Duplicate node in tree: %s" % n["name"])
            lookup[n["name"]] = n
            self._tree[n["name"]] = self._manager.get_new_node(
                    n["type"], n["name"], n["params"], logger=self.logger)
        for name, n in lookup.iteritems():
            for i in range(len(n["inputs"])):            
                self._tree[name].set_input(i, self._tree[n["inputs"][i]])

    def get_terminals(self):
        """
        Get nodes that end a branch.
        """
        return [n for n in self._tree.itervalues() \
                if not n.has_parents()]


TESTTREE = [{
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
    },
]

TESTTREE_OCROPUS = [
    {
        "name": "SegmentPageByRAST",
        "type": "Ocropus::SegmentPageByRAST",
        "params": [
            ("all_pixels", 0),
            ("gap_factor", 10),
        ],
        "inputs": ["RmHalftone"]
    }, {
        "name": "NativeRecognizer",
        "type": "Ocropus::Recognizer",
        "params": [
            ("character_model", "Ocropus Default Char"),
            ("language_model", "Ocropus Default Lang"),
        ],
        "inputs": ["RmHalftone", "SegmentPageByRAST"]
    }
]

TESTTREE_TESSERACT = [
    {
        "name": "SegmentPageBy1CP",
        "type": "Ocropus::SegmentPageBy1CP",
        "params": [
        ],
        "inputs": ["RmHalftone"]
    }, {
        "name": "NativeRecognizer",
        "type": "Tesseract::Recognizer",
        "params": [
            ("language_model", "Tesseract Default Lang"),
        ],
        "inputs": ["RmHalftone", "SegmentPageBy1CP"]
    }
]

TESTTREE_CUNEIFORM = [
    {
        "name": "NativeRecognizer",
        "type": "Cuneiform::Recognizer",
        "params": [
        ],
        "inputs": ["RmHalftone",]
    }
]



def test(name, f, tree):
    print "\nTesting %s: %s" % (name, f)
    tnew = copy.deepcopy(tree)
    for n in tnew:
        if n["name"] == "filein":
            for i in range(len(n["params"])):
                if n["params"][i][0] == "path":
                    n["params"][i] = ("path", f)
    pl = OcrPipeline(tnew)
    doc = pl.get_terminals()[0].eval()
    for line in doc["lines"]:
        print line["text"]

def test_ocropus(*files):
    tree = copy.deepcopy(TESTTREE)
    tree.extend(TESTTREE_OCROPUS)
    for f in files:
        test("Ocropus", f, tree)

def test_tesseract(*files):
    tree = copy.deepcopy(TESTTREE)
    tree.extend(TESTTREE_TESSERACT)
    for f in files:
        test("Tesseract", f, tree)

def test_cuneiform(*files):
    tree = copy.deepcopy(TESTTREE)
    tree.extend(TESTTREE_CUNEIFORM)
    for f in files:
        test("Cuneiform", f, tree)



if __name__ == "__main__":
    if len(sys.argv) > 1:
        files = sys.argv[1:]
        test_ocropus(*files)
        test_tesseract(*files)
        test_cuneiform(*files)



