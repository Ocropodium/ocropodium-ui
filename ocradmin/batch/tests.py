"""
    OCR batch tests.
"""
import os
import re
import shutil
from django.test import TestCase
from django.test.client import Client
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import simplejson

from ocradmin.batch.models import OcrBatch
from ocradmin.core.tests import testutils

from ocradmin.plugins import parameters

TESTFILE = "etc/simple.png"



class OcrBatchTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json",
            "projects/fixtures/test_fixtures.json",
            "batch/fixtures/test_batch.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        testutils.symlink_model_fixtures()
        try:
            os.makedirs("media/files/test_user/test")
        except OSError, (errno, strerr):
            if errno == 17: pass
        try:
            os.symlink(os.path.abspath(TESTFILE),
                    "media/files/test_user/test/%s" % os.path.basename(TESTFILE))
        except OSError, (errno, strerr):
            if errno == 17: pass
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")
        self.client.get("/projects/load/1/")

    def tearDown(self):
        """
            Cleanup a test.
        """
        self.testuser.delete()
        shutil.rmtree("media/files/test_user")

    def test_batch_new(self):
        """
        Test the convert view as a standard GET (no processing.)
        """
        self.assertEqual(self.client.get("/batch/new").status_code, 200)

    def test_batch_create(self):
        """
        Test OCRing with minimal parameters.
        """
        self._test_batch_action()

    def test_results_action(self):
        """
        Test fetching task results.  Assume a batch with pk 1
        exists.
        """
        pk = self._test_batch_action()
        r = self.client.get("/batch/results/%s" % pk)
        self.assert_(r.content, "No content returned")
        content = simplejson.loads(r.content)
        self.assertEqual(
                content[0]["fields"]["tasks"][0]["fields"]["page_name"],
                os.path.basename(TESTFILE))
        return pk

    def test_page_results_page_action(self):
        """
        Test fetching task results.  Assume a page with offset 0
        exists.
        """
        pk = self._test_batch_action()
        r = self.client.get("/batch/results/%s/0/" % pk)
        self.assert_(r.content, "No content returned")
        content = simplejson.loads(r.content)
        self.assertEqual(
                content[0]["fields"]["page_name"],
                os.path.basename(TESTFILE))

    def test_save_transcript(self):
        """
        Test fetching task results.  Assume a page with offset 0
        exists.
        """
        pk = self._test_batch_action()
        r = self.client.get("/batch/results/%s/0/" % pk)
        self.assert_(r.content, "No content returned")
        content = simplejson.loads(r.content)
        self.assertEqual(
                content[0]["fields"]["page_name"],
                os.path.basename(TESTFILE))

    def test_show_action(self):
        """
        Test viewing batch details.
        """
        pk = self._test_batch_action()
        r = self.client.get("/batch/show/%s/" % pk)
        self.assertEqual(r.status_code, 200)

    def test_delete_action(self):
        """
        Test viewing batch details.
        """
        before = OcrBatch.objects.count()
        r = self.client.get("/batch/delete/1/")
        self.assertRedirects(r, "/batch/list/")
        self.assertEqual(before, OcrBatch.objects.count() + 1)

    def _test_batch_action(self, params=None, headers={}):
        """
        Testing actually OCRing a file.
        """
        if params is None:
            params = dict(name="Test Batch",
                    files=os.path.join("test/%s" % os.path.basename(TESTFILE)))
            params.update(parameters.TESTPOST)
        r = self._get_batch_response(params, headers)
        # check the POST redirected as it should
        self.assertEqual(r.redirect_chain[0][1], 302)
        pkmatch = re.match(".+/batch/show/(\d+)/?", r.redirect_chain[0][0])
        self.assertTrue(pkmatch != None)
        return pkmatch.groups()[0]

    def test_file_upload(self):
        """
        Test uploading files to the server.
        """
        fh = file(TESTFILE, "rb")
        params = {}
        params["file1"] = fh
        headers = {}
        r = self.client.post("/batch/upload_files/", params, **headers)
        fh.close()
        content = simplejson.loads(r.content)
        self.assertEqual(content, [os.path.join("test-project-2",
            os.path.basename(TESTFILE))])

    def _get_batch_response(self, params={}, headers={}):
        """
        Post images for conversion with the given params, headers.
        """
        headers["follow"] = True
        return self.client.post("/batch/create/", params, **headers)

