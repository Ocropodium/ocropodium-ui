"""
    Training tests.
"""
import os
import re
import shutil
from django.test import TestCase
from django.test.client import Client
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import simplejson

from ocradmin.core.tests import testutils

TESTFILE = "simple.png"


class TrainingTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json",
            "presets/fixtures/test_fixtures.json",
            "projects/fixtures/test_fixtures.json",
            "reference_pages/fixtures/test_fixtures.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")
        self.client.get("/projects/load/1/")
        testutils.symlink_reference_pages()

    def tearDown(self):
        """
            Cleanup a test.
        """
        self.testuser.delete()
        #shutil.rmtree("media/files/test_user")

    def test_new_view(self):
        """
        Test viewing the training submission form.
        """
        r = self.client.get("/training/new/")
        self.assertEqual(r.status_code, 200)

    def test_comparisons_view(self):
        """
        Test viewing the comparisons list.
        """
        r = self.client.get("/training/comparisons/")
        self.assertEqual(r.status_code, 200)

    def test_score_models(self):
        """
        Test launching a test between two sets
        of settings.  FIXME: Fragile hard-coded
        references to batch & ref set pks.
        """
        params = {
            "name": "Test comparison",
            "script1": 1,
            "script2": 2,
            "tset": 1,
        }
        r = self.client.post("/training/score_models", params, follow=True)
        # check we were redirected to the batch page
        self.assertRedirects(r, "/batch/show/1/")

        # check we can view the comparison results
        r = self.client.get("/training/comparison/1")
        print r.content
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Aggregate")



