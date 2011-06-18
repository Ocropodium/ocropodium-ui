import os
import shutil
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.client import Client
from django.utils import simplejson


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

