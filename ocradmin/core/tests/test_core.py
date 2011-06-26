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
        p = sp.Popen(["accuracy"], stderr=sp.PIPE)
        self.assertRegexpMatches(p.communicate()[1], "^Usage")


