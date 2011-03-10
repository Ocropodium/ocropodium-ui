import os
import shutil
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.client import Client
from django.utils import simplejson

from ocradmin.core.tests import testutils
from ocradmin.ocrmodels.models import OcrModel


AJAX_HEADERS = {
    "HTTP_X_REQUESTED_WITH": "XMLHttpRequest"
}

class OcrModelTest(TestCase):
    fixtures = ["test_fixtures.json"]

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

    def test_ocrmodels_view(self):
        """
        Test basic list view
        """
        self.assertEqual(self.client.get("/ocrmodels/").status_code, 200)

    def test_search(self):
        """
        Test the search function that returns JSON data.
        """

        r = self.client.get("/ocrmodels/search", dict(app="ocropus", type="char"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/json")
        content = simplejson.loads(r.content)
        self.assertEqual(len(content), 1)

    def test_tag_filter(self):
        """
        Test filtering by tag.
        """
        r = self.client.get("/ocrmodels/list", {"tag": "test"})
        self.assertEqual(r.status_code, 200)

    def test_new_ajax_form(self):
        """
        Test requesting a new upload form via Ajax works.
        """
        r = self.client.get("/ocrmodels/new", {}, **AJAX_HEADERS)
        self.assertEqual(r.status_code, 200)
        # make sure there's a form in the results
        self.assertTrue(r.content.find("<form") != -1)

    def test_create_model_ajax(self):
        """
        Test creating a new model from an uploaded file.
        """
        # we shouldn't have any ocrmodels in the DB yet.  If
        # successful it'll redirect back to the list.
        before = OcrModel.objects.count()
        r = self._create_test_model()
        self.assertEqual(r.status_code, 302)
        self.assertEqual(before + 1, OcrModel.objects.count())

    def test_edit_model_view(self):
        """
        Test viewing the edit for (no Ajax).
        """
        r = self.client.get("/ocrmodels/edit/1/")
        self.assertEqual(r.status_code, 200)

    def test_edit_model_not_found(self):
        """
        Test viewing the edit form for a non-existant item.  Note:
        horrible hardcoding of "high" primary key.
        """
        r = self.client.get("/ocrmodels/edit/666/")
        self.assertEqual(r.status_code, 404)

    def test_update_model(self):
        """
        Test the updating of the fixture model.
        """
        r = self._update_test_model()
        self.assertEqual(r.status_code, 302)
        model = OcrModel.objects.get(pk=1)
        self.assertEqual(model.description, "")

    def _create_test_model(self):
        """
        Insert a post test model view post
        """

        modelpath = OcrModel.objects.all()[0].file.path
        with open(modelpath) as tf:
            r = self.client.post(
                "/ocrmodels/create",
                dict(
                    user=self.testuser.pk,
                    tags="test model",
                    name="Test Model",
                    description="Testing model creation",
                    public=True,
                    app="ocropus",
                    type="char",
                    file=tf,
                ),
            )
        return r

    def _update_test_model(self):
        """
        Update the fixture model.
        """
        return self.client.post(
            "/ocrmodels/update/1/",
            dict(
                name="Test Update Model",
                tags="test model update",
                app="ocropus",
                type="char",
                description="",
                public=False,
            ),
        )

