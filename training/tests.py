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


TESTFILE = "simple.png"


class TrainingTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json",
            "projects/fixtures/test_fixtures.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        #shutil.copy2("media/models/mytessdata.tgz", "media/test/engtessdata.tgz")
        #shutil.copy2("media/models/default.model", "media/test/default.model")
        #shutil.copy2("media/models/default.fst", "media/test/default.fst")
        #os.makedirs("media/files/test_user/test")
        #shutil.copy2("media/test/%s" % TESTFILE, "media/files/test_user/test/%s" % TESTFILE)
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")
        self.client.get("/projects/load/1/")


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


    def test_list_view(self):
        """
        Test viewing the training set list.
        """
        r = self.client.get("/training/list/")
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
        r = self.client.post("/training/score_models", {
            "name": "Test comparison",
            "p0_paramset_name": "Test Ocropus",
            "p1_paramset_name": "Test Tesseract",
            "p0_engine": "ocropus",
            "p1_engine": "tesseract",
            "tset": 1,
        }, follow=True)
        # check we were redirected to the batch page
        self.assertRedirects(r, "/batch/show/1/")



