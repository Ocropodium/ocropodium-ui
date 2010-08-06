"""
    OCR batch tests.
"""
import os
import shutil
from django.test import TestCase
from django.test.client import Client
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import simplejson


TESTFILE = "simple.png"


class OcrBatchTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json"]
    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        shutil.copy2("media/models/mytessdata.tgz", "media/test/engtessdata.tgz")
        shutil.copy2("media/models/default.model", "media/test/default.model")
        shutil.copy2("media/models/default.fst", "media/test/default.fst")
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
        self.assertEqual(self.client.get("/batch/batch").status_code, 200)

    def test_convert_action_basic(self):
        """
        Test OCRing with minimal parameters.
        """
        self._test_batch_action()        


    def test_convert_action_seg(self):
        """
        Test OCRing with variable segmentation.
        """
        self._test_batch_action({"psegmenter": "SegmentPageByXYCUTS"})        


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

    def _test_batch_action(self, params=None, headers={}):
        """
        Testing actually OCRing a file.
        """
        if params is None:
            params = {}
        r = self._get_batch_response(params, headers) 
        self.assertEqual(r.status_code, 200)

        # check we recieve JSON back
        self.assert_(r.content, "No content returned")
        content = simplejson.loads(r.content)
        self.assertEqual(len(content), 1)
        # Note: we'd not normally expect any results here because we're
        # not using the "nohang" parameter, but since tests are executed 
        # locally we will
        self.assertTrue(content[0]["pk"] is not None, "Unable to get results")
        return content[0]["pk"]
      

    def _get_batch_response(self, params={}, headers={}):
        """
        Post images for conversion with the given params, headers.
        """
        tf1 = open(os.path.join(settings.MEDIA_ROOT, "test", TESTFILE))
        tf2 = open(os.path.join(settings.MEDIA_ROOT, "test", TESTFILE))
        params["image1"] = tf1
        params["image2"] = tf2
        r = self.client.post("/batch/batch/", params, **headers)
        tf1.close()
        tf2.close()
        return r
        

