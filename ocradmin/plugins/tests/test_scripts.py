"""
    Test the scripts.
"""
import os
from django.test import TestCase
from django.utils import simplejson
from django.conf import settings

from nodetree import script, node
from nodetree.manager import ModuleManager
import numpy

SCRIPTDIR = "plugins/fixtures/scripts"

# nodetree bits
from nodetree import manager



class ScriptsTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        self.scripts = {}
        self.manager = manager.ModuleManager()
        self.manager.register_module("ocradmin.plugins.ocropus_nodes")
        self.manager.register_module("ocradmin.plugins.tesseract_nodes")
        self.manager.register_module("ocradmin.plugins.cuneiform_nodes")
        self.manager.register_module("ocradmin.plugins.numpy_nodes")
        self.manager.register_module("ocradmin.plugins.pil_nodes")
        for fname in os.listdir(SCRIPTDIR):
            if fname.endswith("json"):
                with open(os.path.join(SCRIPTDIR, fname), "r") as f:
                    self.scripts[fname] = simplejson.load(f)
        
    def tearDown(self):
        """
            Cleanup a test.
        """
        pass

    def test_valid_scripts(self):
        """
        Test the supposedly valid script don't raise errors.
        """
        for name, nodes in self.scripts.iteritems():
            if name.startswith("invalid"):
                continue
            s = script.Script(nodes, manager=self.manager)
            terms = s.get_terminals()
            self.assertTrue(len(terms) > 0, msg="No terminal nodes found.")

            # check we get an expected type from evaling the nodes
            for n in terms:
                out = n.eval()
                self.assertIn(type(out), (dict, list, numpy.ndarray), 
                        msg="Unexpected output type for node %s: %s" % (
                            n.name, type(out)))

    def test_invalid_scripts(self):
        """
        Test supposedly invalid script DO raise errors.
        """
        for name, nodes in self.scripts.iteritems():
            if not name.startswith("invalid"):
                continue
            s = script.Script(nodes, manager=self.manager)
            terms = s.get_terminals()
            self.assertTrue(len(terms) > 0, msg="No terminal nodes found.")
            # check we get an expected type from evaling the nodes
            for n in terms:
                self.assertRaises(node.ValidationError, n.eval)


        


