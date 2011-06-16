"""
Base class for Plugin/OCR script tests.
"""

from django.test import TestCase

# nodetree bits
from nodetree import manager

from ocradmin.core.tests import testutils

class OcrScriptTest(TestCase):
    """
    Base class that sets of the manager with our
    OCR-related nodes.
    """
    def setUp(self):
        """
            Setup OCR tests.
        """
        self.manager = manager.ModuleManager()
        self.manager.register_module("ocradmin.plugins.ocropus_nodes")
        self.manager.register_module("ocradmin.plugins.tesseract_nodes")
        self.manager.register_module("ocradmin.plugins.cuneiform_nodes")
        self.manager.register_module("ocradmin.plugins.numpy_nodes")
        self.manager.register_module("ocradmin.plugins.pil_nodes")
        testutils.symlink_model_fixtures()

    def tearDown(self):
        pass



