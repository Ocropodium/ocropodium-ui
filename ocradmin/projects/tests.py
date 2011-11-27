import os
import shutil
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.client import Client
from django.utils import simplejson

from ocradmin.projects.models import Project


AJAX_HEADERS = {
    "HTTP_X_REQUESTED_WITH": "XMLHttpRequest"
}

class ProjectsTest(TestCase):
    fixtures = ["test_fixtures.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")

    def tearDown(self):
        """
            Cleanup a test.
        """
        self.testuser.delete()

    def test_projects_view(self):
        """
        Test basic list view
        """
        self.assertEqual(self.client.get("/projects/").status_code, 200)

    def test_tag_filter(self):
        """
        Test filtering by tag.
        """
        r = self.client.get("/projects/list", {"tag": "test"})
        self.assertEqual(r.status_code, 200)

    def test_new_ajax_form(self):
        """
        Test requesting a new upload form via Ajax works.
        """
        r = self.client.get("/projects/create/", {}, **AJAX_HEADERS)
        self.assertEqual(r.status_code, 200)
        # make sure there's a form in the results
        self.assertTrue(r.content.find("<fieldset") != -1)

    def test_create_project_ajax(self):
        """
        Test creating a new project from an uploaded file.
        """
        # we shouldn't have any projects in the DB yet.  If
        # successful it'll redirect back to the list.
        before = Project.objects.count()
        r = self._create_test_project()
        self.assertEqual(r.status_code, 302)
        self.assertEqual(before + 1, Project.objects.count())

    def test_edit_project_view(self):
        """
        Test viewing the edit for (no Ajax).
        """
        r = self.client.get("/projects/edit/1/")
        self.assertEqual(r.status_code, 200)

    def test_edit_project_not_found(self):
        """
        Test viewing the edit form for a non-existant item.
        """
        r = self.client.get("/projects/edit/666666/")
        self.assertEqual(r.status_code, 404)

    def test_update_project(self):
        """
        Test the updating of the fixture project.
        """
        r = self._update_test_project()
        self.assertEqual(r.status_code, 302)
        project = Project.objects.get(pk=1)
        self.assertEqual(project.description, "")

    def test_confirm_delete(self):
        """
        Test checking if the user wants to delete a project.
        """
        r = self._create_test_project()
        project = Project.objects.get(pk=1)
        r = self.client.get("/projects/delete/1/")
        self.assertEqual(r.status_code, 200)

    def test_delete_project(self):
        """
        Test actually deleting a project.
        """
        r = self._create_test_project()
        before = Project.objects.count()
        r = self.client.post("/projects/delete/1/")
        self.assertEqual(r.status_code, 302)
        after = Project.objects.count()
        self.assertEqual(before, after + 1)

    def _create_test_project(self):
        """
        Insert a post test project view post
        """
        return self.client.post(
            "/projects/create", { 
                "0-name"              : "Yet ANother test",
                "0-description"       : "",
                "0-storage_backend"   : "FedoraStorage",
                "0-tags"              : "",
                "1-root"              : "localhost:8080/fedora",
                "1-image_name"        : "IMG",
                "1-password"          : "fedora",
                "1-namespace"          : "yet-another-test",
                "1-transcript_name"   : "TRANSCRIPT",
                "1-username"          : "fedoraAdmin",
                "hash_0"              : "89075382b10c271f10c479251fa68c057242ba40",
                "wizard_step"         : "1",
            }
        )

    def _update_test_project(self):
        """
        Update the fixture project.
        """
        return self.client.post(
            "/projects/edit/1/",
            dict(
                name="Test Update Project",
                tags="test project update",
                storage_backend="FileSystemStorage",
                description="",
            ),
        )
