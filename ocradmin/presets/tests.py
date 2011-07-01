"""
Test plugin views.
"""

import os
import glob
from django.test import TestCase
from django.utils import simplejson as json
from django.conf import settings
from django.test.client import Client
from django.contrib.auth.models import User

from ocradmin.core.tests import testutils
from nodetree import script, node, manager
import numpy
from mock import patch

SCRIPTDIR = "plugins/fixtures/scripts"

from ocradmin.plugins import cache


class ViewsTest(TestCase):
    fixtures = ["ocrmodels/fixtures/test_fixtures.json"]

    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        self.manager = manager.ModuleManager()
        self.manager.register_paths(
                glob.glob("plugins/*_nodes.py"), root="ocradmin")
        testutils.symlink_model_fixtures()
        self.scripts = {}
        for fname in os.listdir(SCRIPTDIR):
            if fname.endswith("json"):
                with open(os.path.join(SCRIPTDIR, fname), "r") as f:
                    self.scripts[fname] = json.load(f)
        self.testuser = User.objects.create_user("test_user", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")

    def tearDown(self):
        """
        Revert any changes.
        """
        #cache.PersistantFileCacher = self.old_cacher

    def test_binarise_script(self):
        """
        Test a script that should return image data, i.e.
        a path to a DZI file.
        """
        self._run_script("binarize.json", "SUCCESS", "image", ["dzi", "path"])

    def test_segment_script(self):
        """
        Test a script that should return line image geometry.
        """
        self._run_script("segment.json", "SUCCESS", "pseg", ["dzi", "lines"])

    def test_ocropus_script(self):
        """
        Test a script that should return transcript data.
        """
        self._run_script("ocropus.json", "SUCCESS", "hocr", ["data"])

    def test_tesseract_script(self):
        """
        Test a script that should return transcript data.
        """
        self._run_script("tesseract.json", "SUCCESS", "hocr", ["data"])

    def test_cuneiform_script(self):
        """
        Test a script that should return transcript data.
        """
        self._run_script("cuneiform.json", "SUCCESS", "hocr", ["data"])

    def test_evaluation_script(self):
        """
        Test a script that should return transcript data.
        """
        self._run_script("evaluation.json", "SUCCESS", "text", ["data"])

    def test_invalid_path(self):
        """
        Test a script that should return a node error.
        """
        script = self.scripts.get("invalid_filein_path.json")
        self.assertIsNotNone(script)
        r = self.client.post("/presets/run/", dict(
            script=json.dumps(script)))
        content = json.loads(r.content)
        for field in ["status", "errors"]:
            self.assertIn(field, content, "No '%s' field in content" % field)
        expectedstatus = "VALIDATION"
        self.assertEqual(expectedstatus, 
                content["status"], "Status field is not '%s'" % expectedstatus)
        self.assertIn("filein1", content["errors"], "'filein1' not in errors field" )

    @patch(settings.NODETREE_PERSISTANT_CACHER, cache.TestMockCacher)
    def _run_script(self, scriptname, expectedstatus, expectedtype, expecteddatafields):
        """
        Run a script and assert the results resemble what we expect.
        """
        script = self.scripts.get(scriptname)
        self.assertIsNotNone(script)
        r = self.client.post("/presets/run/", dict(script=json.dumps(script)))
        content = json.loads(r.content)
        for field in ["status", "task_id", "results"]:
            self.assertIn(field, content, "No '%s' field in content" % field)
        self.assertEqual(expectedstatus, 
                content["status"], "Status field is not '%s'" % expectedstatus)
        for field in ["type"]:
            self.assertIn(field, content["results"], "No '%s' field in content results" % field)
        self.assertEqual(expectedtype, 
                content["results"]["type"], "Type field is not '%s'" % expectedtype)
        for field in expecteddatafields:
            self.assertIn(field, content["results"], "No '%s' field in content results" % field)
        return content
