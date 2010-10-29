"""
This file demonstrates two different styles of tests (one doctest and one
unittest). These will both pass when you run "manage.py test".

Replace these with more appropriate tests for your application.
"""

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.client import Client



class OcrTaskTest(TestCase):
    fixtures = ["test_batch.json", "test_task.json"]

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


    def test_ocrtasks_view(self):
        """
        Test basic list view
        """
        self.assertEqual(self.client.get("/ocrtasks/").status_code, 200)


    def test_ocrtasks_show(self):
        """
        Test viewing task details.
        """
        self.assertEqual(self.client.get("/ocrtasks/show/1/").status_code, 200)


