"""
Admin tests.  This should ensure all our routes are
working, because the admin site introspects them.
"""
from django.test import TestCase
from django.test.client import Client
from django.contrib.auth.models import User
from django.conf import settings


class AdminTest(TestCase):
    def setUp(self):
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.testuser.is_staff = True
        self.client = Client()
        #self.client.login(username="test_user", password="testpass")

    def tearDown(self):
        self.testuser.delete()

    def test_access_admin(self):
        r = self.client.get("/accounts/login", {}, follow=True)
        self.assertEqual(r.status_code, 200)



