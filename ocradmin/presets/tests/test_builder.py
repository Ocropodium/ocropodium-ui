"""
Test preset builder non-JS functionality.
"""

from django.test import TestCase
from django.utils import simplejson as json
from django.conf import settings
from django.test.client import Client
from django.contrib.auth.models import User

from ocradmin.ocrtasks.models import OcrTask

from ocradmin.core.tests import testutils


class BuilderTest(TestCase):
    fixtures = [
            "presets/fixtures/profile_fixtures.json",
            "presets/fixtures/test_fixtures.json",
            "ocrmodels/fixtures/test_fixtures.json"
            "projects/fixtures/test_fixtures.json",
            "batch/fixtures/test_batch.json",
            "ocrtasks/fixtures/test_task.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")

    def tearDown(self):
        """
        Revert any changes.
        """
        self.testuser.delete()

    def test_builder(self):
        r = self.client.get("/presets/builder/")
        self.assertEqual(r.status_code, 200)

    def test_builder_edit_task(self):
        task = OcrTask.objects.all()[0]
        r = self.client.get("/presets/builder/%s/" % task.id)
        self.assertEqual(r.status_code, 200)


