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

from ocradmin.batch.models import Batch
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.reference_pages.models import ReferencePage
from ocradmin.core.tests import testutils

from django.utils import simplejson as json

TESTFILE = "etc/simple.png"
SCRIPT1 = "plugins/fixtures/scripts/tesseract.json"
SCRIPT2 = "plugins/fixtures/scripts/ocropus.json"



class BatchTest(TestCase):
    fixtures = [
            "ocrtasks/fixtures/test_task.json",
            "transcripts/fixtures/test_transcript.json",
            "ocrmodels/fixtures/test_fixtures.json",
            "projects/fixtures/test_fixtures.json",
            "presets/fixtures/test_fixtures.json",
            "batch/fixtures/test_batch.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        with open(SCRIPT1, "r") as s1:
            self.script1 = s1.read()
        with open(SCRIPT2, "r") as s2:
            self.script2 = s2.read()
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
        content = json.loads(r.content)
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
        content = json.loads(r.content)
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
        content = json.loads(r.content)
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
        before = Batch.objects.count()
        r = self.client.post("/batch/delete/1/", follow=True)
        self.assertRedirects(r, "/batch/list/")
        self.assertEqual(before, Batch.objects.count() + 1)

    def test_create_refpath_from_task(self):
        """
        Test creating a ref page from a task object.
        Note:  There's one fixture test ref page already
        (called test.png).  If we try to create one with the
        same name as an existing page it will simply update
        the page data (transcript.)  So asserting that there'll
        be one more ref page in the DB after the operation
        is a fragile assumption - it depends on the new page
        NOT having the same name as the current fixture.
        """
        tasksbefore = OcrTask.objects.count()
        batchpk = self._test_batch_action()
        tasksafter = OcrTask.objects.count()
        self.assertEqual(tasksbefore, tasksafter - 1)
        newtask = OcrTask.objects.all().order_by("-created_on")[0]
        refbefore = ReferencePage.objects.count()
        r = self.client.post(
                "/reference_pages/create_from_task/%s/" % newtask.pk)
        self.assertEqual(r.status_code, 200)
        refafter = ReferencePage.objects.count()
        self.assertEqual(refbefore, refafter - 1)

    def _test_batch_action(self, params=None, headers={}):
        """
        Testing actually OCRing a file.
        """
        if params is None:
            params = dict(
                    name="Test Batch",
                    user=self.testuser.pk,
                    project=1,
                    task_type="run.batchitem",
                    files=os.path.join("test-project-2", os.path.basename(TESTFILE)),
                    preset=1,
            )
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
        with file(TESTFILE, "rb") as fh:
            params = {}
            params["file1"] = fh
            headers = {}
            r = self.client.post("/batch/upload_files/", params, **headers)
        #fh.close()
        content = json.loads(r.content)
        self.assertEqual(content, [os.path.join("test-project-2",
            os.path.basename(TESTFILE))])

    def _get_batch_response(self, params={}, headers={}):
        """
        Post images for conversion with the given params, headers.
        """
        headers["follow"] = True
        return self.client.post("/batch/create/", params, **headers)


