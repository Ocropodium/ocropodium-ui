"""
Test accounts views.
"""

from django.test import TestCase
from django.test.client import Client
from django.contrib.auth.models import User


class AccountsTest(TestCase):
    def setUp(self):
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")   
        self.client = Client()

    def tearDown(self):
        self.testuser.delete()        

    def test_login_view(self):
        """
        Test basic login view
        """
        self.assertEqual(self.client.get("/accounts/login/").status_code, 200)

    def test_login_action(self):
        """
        Test login user
        """
        r = self.client.post(
            "/accounts/login/",
            { "username": self.testuser.username, "password": "testpass" }
        )
        # we should be redirected to the next page if successful.  Otherwise
        # it'll render the login form        
        self.assertEqual(r.status_code, 302)


    def test_logout_action(self):
        """
        Test logging a user out.
        """
        r = self.client.get("/accounts/logout")
        self.assertEqual(r.status_code, 302)


__test__ = {"doctest": """
Another way to test that 1 + 1 is equal to 2.

>>> 1 + 1 == 2
True
"""}

