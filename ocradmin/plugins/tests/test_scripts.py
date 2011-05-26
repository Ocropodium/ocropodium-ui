"""
    Test the scripts.
"""
import os
from django.test import TestCase
from django.utils import simplejson

from ocradmin.plugins import script
import numpy

SCRIPTDIR = "plugins/fixtures/scripts"

class ScriptsTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        self.scripts = []
        for fname in os.listdir(SCRIPTDIR):
            if fname.endswith("json"):
                with open(os.path.join(SCRIPTDIR, fname), "r") as f:
                    self.scripts.append(simplejson.load(f))
        
    def tearDown(self):
        """
            Cleanup a test.
        """
        pass

    def test_scripts(self):
        """
        Test the convert view as a standard GET (no processing.)
        """
        for nodes in self.scripts:
            s = script.Script(nodes)
            terms = s.get_terminals()
            self.assertTrue(len(terms) > 0, msg="No terminal nodes found.")

            # check we get an expected type from evaling the nodes
            for node in terms:
                out = node.eval()
                self.assertIn(type(out), (dict, list, numpy.ndarray), 
                        msg="Unexpected output type for node %s: %s" % (
                            node.name, type(out)))


        


