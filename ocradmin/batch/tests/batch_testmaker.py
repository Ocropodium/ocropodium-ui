#coding: utf-8
from django.test import TestCase
from django.test import Client
from django import template
from django.db.models import get_model

class Testmaker(TestCase):

    #fixtures = ["batch_testmaker"]


    def test_batchnew_131016997426(self):
        r = self.client.get('/batch/new/', {})
        self.assertEqual(r.status_code, 302)
    def test_staticjsfile_data_sourcejs_131016997541(self):
        r = self.client.get('/static/js/file_data_source.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsfile_list_widgetjs_131016997542(self):
        r = self.client.get('/static/js/file_list_widget.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsuploadersajaxjs_131016997543(self):
        r = self.client.get('/static/js/uploaders/ajax.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssfile_list_widgetcss_131016997544(self):
        r = self.client.get('/static/css/file_list_widget.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsbatchnewjs_131016997544(self):
        r = self.client.get('/static/js/batch/new.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssgenericcss_131016997545(self):
        r = self.client.get('/static/css/generic.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssformscss_131016997545(self):
        r = self.client.get('/static/css/forms.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcsscleancss_131016997546(self):
        r = self.client.get('/static/css/clean.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssupload_resultscss_131016997546(self):
        r = self.client.get('/static/css/upload_results.css', {})
        self.assertEqual(r.status_code, 200)
    def test_batchcreate_131016999447(self):
        r = self.client.post('/batch/create/', {'files': 'another-test-project/align-input-1.png,another-test-project/align-input-2.png', 'task_type': 'run.batchitem', 'name': 'Another Test Project - Batch 2', 'tags': '', 'project': '1', 'preset': '26', 'user': '1', 'description': 'Hello, world', })
    def test_batchshow3_131016999465(self):
        r = self.client.get('/batch/show/3/', {})
        self.assertEqual(r.status_code, 302)
    def test_staticjsbatchshowjs_131016999482(self):
        r = self.client.get('/static/js/batch/show.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssbatch_widgetcss_131016999483(self):
        r = self.client.get('/static/css/batch_widget.css', {})
        self.assertEqual(r.status_code, 200)
    def test_batchresults3_13101699950(self):
        r = self.client.get('/batch/results/3/', {'start': '0', 'limit': '60', })
        self.assertEqual(r.status_code, 302)
    def test_ocrtasksshow9_131017000009(self):
        r = self.client.get('/ocrtasks/show/9/', {})
        self.assertEqual(r.status_code, 302)
    def test_ocrtask_config9_131017000013(self):
        r = self.client.get('/ocr/task_config/9/', {})
        self.assertEqual(r.status_code, 302)
    def test_ocrtasksshow10_131017000343(self):
        r = self.client.get('/ocrtasks/show/10/', {})
        self.assertEqual(r.status_code, 302)
    def test_ocrtask_config10_131017000347(self):
        r = self.client.get('/ocr/task_config/10/', {})
        self.assertEqual(r.status_code, 302)
    def test_batchtranscript3_131017000502(self):
        r = self.client.get('/batch/transcript/3/', {})
        self.assertEqual(r.status_code, 302)
    def test_ocrtranscript10_131017000504(self):
        r = self.client.get('/ocr/transcript/10/', {})
        self.assertEqual(r.status_code, 302)
    def test_staticjsundocommandjs_13101700053(self):
        r = self.client.get('/static/js/ocr_js/undo/command.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsundostackjs_131017000533(self):
        r = self.client.get('/static/js/ocr_js/undo/stack.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsline_editorjs_131017000534(self):
        r = self.client.get('/static/js/line_editor.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsspellchecksuggestion_listjs_131017000534(self):
        r = self.client.get('/static/js/spellcheck/suggestion_list.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsspellcheckspellcheckerjs_131017000535(self):
        r = self.client.get('/static/js/spellcheck/spellchecker.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjstranscript_editorjs_131017000536(self):
        r = self.client.get('/static/js/transcript_editor.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsocrtranscriptjs_131017000537(self):
        r = self.client.get('/static/js/ocr/transcript.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcsstranscript_editorcss_131017000538(self):
        r = self.client.get('/static/css/transcript_editor.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssline_editorcss_131017000539(self):
        r = self.client.get('/static/css/line_editor.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssspellcheckcss_13101700054(self):
        r = self.client.get('/static/css/spellcheck.css', {})
        self.assertEqual(r.status_code, 200)
    def test_ocrtask_transcript10_131017000563(self):
        r = self.client.get('/ocr/task_transcript/10', {})
        self.assertEqual(r.status_code, 302)
    def test_ocrsubmit_viewer_binarization10_131017000581(self):
        r = self.client.get('/ocr/submit_viewer_binarization/10/', {})
        self.assertEqual(r.status_code, 302)
