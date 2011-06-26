"""
Core tests.  Test general environment.
"""

import subprocess as sp
from django.test import TestCase
from django.test.client import Client
from django.contrib.auth.models import User
from django.conf import settings


class CoreTest(TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_isri_tools(self):
        """
        Ensure running 'accuracy' with no args results
        in usage info.  Basically we want to make sure
        that the accuracy binary is available.
        """
        stdout, stderr = self._run_cmd("accuracy")
        self.assertRegexpMatches(stderr, "^Usage")

    def test_cuneiform(self):
        """
        Ensure cuneiform is available.  This is fragile since it depends
        on Cuneiform's annoying output on stdout.
        """
        stdout, stderr = self._run_cmd("cuneiform")
        self.assertRegexpMatches(stdout, "^Cuneiform for Linux")

    def test_tesseract(self):
        """
        Ensure tesseract is available.
        """
        stdout, stderr = self._run_cmd("tesseract")
        self.assertRegexpMatches(stderr, "^Usage")

    def test_convert(self):
        """
        Ensure (Image|Graphics)Magick is available.
        """
        stdout, stderr = self._run_cmd("convert")
        self.assertRegexpMatches(stdout, "Usage")

    def _run_cmd(self, *args):
        p = sp.Popen(args, stdout=sp.PIPE, stderr=sp.PIPE)
        return p.communicate()

