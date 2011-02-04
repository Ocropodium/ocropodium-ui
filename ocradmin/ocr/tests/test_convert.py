"""
    OCR convert tests.
"""
import os
import shutil
from django.test import TestCase
from django.test.client import Client
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import simplejson

from ocradmin.ocr.tests import testutils
from ocradmin.ocrtasks.models import OcrTask

TESTFILE = "etc/simple.png"

class OcrConvertTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json"]
    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        testutils.symlink_model_fixtures()
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")

    def tearDown(self):
        """
            Cleanup a test.
        """
        self.testuser.delete()


    def test_convert_view(self):
        """
        Test the convert view as a standard GET (no processing.)
        """
        self.assertEqual(self.client.get("/ocr/convert").status_code, 200)

    def test_convert_action_basic(self):
        """
        Test OCRing with minimal parameters.
        """
        self._test_convert_action()        

    def test_convert_action_tess(self):
        """
        Test OCRing with Tesseract as the engine.
        """
        self._test_convert_action({
            "engine": "tesseract",
            "lmodel": "Default Tesseract English"
        })        

    def test_convert_action_ocropus(self):
        """
        Test OCRing with OCRopus as the engine.
        """
        self._test_convert_action({
            "engine": "ocropus", 
            "cmodel": "Default Character Model",
            "lmodel": "Default Language Model"
        })        

    def test_convert_action_seg(self):
        """
        Test OCRing with variable segmentation.
        """
        self._test_convert_action({"$psegmenter": "SegmentPageByXYCUTS"})        

    def test_convert_plain_text(self):
        """
        Fetch results and request plain text back.
        """
        r = self._get_convert_response(params={"format":"text"}, headers={"ACCEPT":"text/plain"})
        self.assertEqual(r.status_code, 200)
        # check the response is not JSON
        self.assertRaises(ValueError, simplejson.loads, r.content)
        self.assertEqual(r["Content-Type"], "text/plain")

    def test_results_plain_text(self):
        """
        Fetch results and request plain text back.
        """
        r = self._get_convert_response(params={"format":"json"})
        self.assertEqual(r.status_code, 200)
        # check the response IS JSON at this stage
        content = simplejson.loads(r.content)
        r2 = self.client.get("/ocr/results/%s" % content[0]["task_id"], {"format": "text"})
        self.assertEqual(r2.status_code, 200)        
        self.assertRaises(ValueError, simplejson.loads, r2.content)
        self.assertEqual(r2["Content-Type"], "text/plain")

    def test_results_action(self):
        """
        Test fetching task results.  We can't meaningfully do this
        locally, because when testing the celery backend  is bypassed.
        However we can get the view works and returns a stub task.
        """
        import uuid
        r = self.client.get("/ocr/results/%s" % uuid.uuid1())
        self.assert_(r.content, "No content returned")
        content = simplejson.loads(r.content)
        # unknown tasks should come back with status 'PENDING'
        self.assertEqual(content["status"], "PENDING")

    def test_transcript_action(self):
        """
        Test viewing the transcript for a new batch.
        """
        r = self._get_convert_response()
        self.assertEqual(r.status_code, 200)
        task = OcrTask.objects.all().order_by("-created_on")[0]
        r = self.client.get("/ocr/transcript/%s/" % task.pk)
        self.assertEqual(r.status_code, 200)

    def test_edit_convert_view(self):
        """
        Test viewing the edit task page.
        """
        r = self._get_convert_response()
        self.assertEqual(r.status_code, 200)
        task = OcrTask.objects.all().order_by("-created_on")[0]
        r = self.client.get("/ocr/convert/%s/" % task.pk)
        self.assertEqual(r.status_code, 200)

    def test_edit_convert_action(self):
        """
        Test updating a tasks parameters.
        """
        r = self._get_convert_response()
        self.assertEqual(r.status_code, 200)
        task = OcrTask.objects.all().order_by("-created_on")[0]
        r = self.client.post(
            "/ocr/update_task/%s/" % task.pk,
            {"$psegmenter": "SegmentPageBy1CP",},                
        )
        self.assertEqual(r.status_code, 302)

    def _test_convert_action(self, params=None, headers={}):
        """
        Testing actually OCRing a file.
        """
        if params is None:
            params = {}
        r = self._get_convert_response(params, headers) 
        self.assertEqual(r.status_code, 200)

        # check we recieve JSON back
        self.assert_(r.content, "No content returned")
        content = simplejson.loads(r.content)
        self.assertEqual(len(content), 1)
        # Note: we'd not normally expect any results here because we're
        # not using the "nohang" parameter, but since tests are executed 
        # locally we will
        self.assertTrue(content[0]["results"] is not None, "Unable to get results")
      
    def _get_convert_response(self, params={}, headers={}):
        """
        Post an image for conversion with the given params, headers.
        """
        tf = open(TESTFILE)
        params["image1"] = tf
        r = self.client.post("/ocr/convert", params, **headers)
        tf.close()
        return r
        
