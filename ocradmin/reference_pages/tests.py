import os
import shutil
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.client import Client
from django.utils import simplejson

from ocradmin.reference_pages.models import ReferencePage
from ocradmin.ocrtasks.models import OcrPageTask
from ocradmin.plugins import parameters


AJAX_HEADERS = {
    "HTTP_X_REQUESTED_WITH": "XMLHttpRequest"
}
TESTFILE = "etc/simple.png"

class ReferencePageTest(TestCase):
    fixtures = ["test_fixtures.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")
        self.client.get("/projects/load/1/")


    def tearDown(self):
        """
            Cleanup a test.
        """
        self.testuser.delete()


    def test_list(self):
        """
        Test listing ref pages.
        """
        # we shouldn't have any projects in the DB yet.  If 
        # successful it'll redirect back to the list.
        r = self.client.get("/reference_pages/list/")
        self.assertEqual(r.status_code, 200)


    def test_show(self):
        """
        Test viewing a ref page.
        """
        # we shouldn't have any projects in the DB yet.  If 
        # successful it'll redirect back to the list.
        r = self.client.get("/reference_pages/show/1/")
        self.assertEqual(r.status_code, 200)


    def test_delete(self):
        """
        Test actually deleting a ref page.
        """
        r = self.client.post("/reference_pages/delete/1/")
        self.assertRedirects(r, "/reference_pages/list")


    def test_create_from_task(self):
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
        tasksbefore = OcrPageTask.objects.count()
        tf = open(TESTFILE)
        headers = {}
        params = parameters.TESTPOST
        params["image1"] = tf
        r = self.client.post("/ocr/convert", params, **headers)
        #tf.close()        
        self.assertEqual(r.status_code, 200)
        tasksafter = OcrPageTask.objects.count()        
        self.assertEqual(tasksbefore, tasksafter - 1)
        newtask = OcrPageTask.objects.all().order_by("-created_on")[0]
        refbefore = ReferencePage.objects.count()
        r = self.client.post(
                "/reference_pages/create_from_task/%s/" % newtask.pk)
        self.assertEqual(r.status_code, 200)
        refafter = ReferencePage.objects.count()
        self.assertEqual(refbefore, refafter - 1)

        

