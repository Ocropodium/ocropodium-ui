#coding: utf-8
import os
import glob
from django.test import TestCase
from django.test import Client
from django import template
from django.db.models import get_model
from django.contrib.auth.models import User

from ocradmin.core.tests import testutils
from nodetree import script, node

class Testmaker(TestCase):

    fixtures = [
            "presets/fixtures/profile_fixtures.json",
            "presets/fixtures/test_fixtures.json"
    ]
    
    def setUp(self):
        """
            Setup OCR tests.  Creates a test user.
        """
        testutils.symlink_model_fixtures()
        self.testuser = User.objects.create_user("AnonymousUser", "test@testing.com", "testpass")
        self.client = Client()
        self.client.login(username="test_user", password="testpass")

    def test_presetsbuilder_131016874872(self):
        r = self.client.get('/presets/builder/', {})
        self.assertEqual(r.status_code, 302)
    def test_staticcssformscss_131016875011(self):
        r = self.client.get('/static/css/forms.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcsscleancss_131016875012(self):
        r = self.client.get('/static/css/clean.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssnodetreecss_131016875013(self):
        r = self.client.get('/static/css/nodetree.css', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjsuploadersajaxjs_131016875014(self):
        r = self.client.get('/static/js/uploaders/ajax.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjspresetsbuilderjs_131016875015(self):
        r = self.client.get('/static/js/presets/builder.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticjspreset_managerjs_131016875015(self):
        r = self.client.get('/static/js/preset_manager.js', {})
        self.assertEqual(r.status_code, 200)
    def test_staticcssimage_viewercss_131016875018(self):
        r = self.client.get('/static/css/image_viewer.css', {})
        self.assertEqual(r.status_code, 200)
    def test_presetsquery_131016875081(self):
        r = self.client.get('/presets/query/', {})
        self.assertEqual(r.status_code, 200)
    def test_presetslist_131016875553(self):
        r = self.client.get('/presets/list/', {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(unicode(r.context["media"]), u"""screen""")
        self.assertEqual(unicode(r.context["preset_list"]), u"""[<Preset: CuneiformBasic>, <Preset: Evaluation Test>, <Preset: OcropusBasic>, <Preset: SegmentTest>, <Preset: SwitchTest>, <Preset: TesseractBasic>]""")
        self.assertEqual(unicode(r.context["fields"]), u"""['name', 'description', 'user', 'created_on']""")
        self.assertEqual(unicode(r.context["object_list"]), u"""[<Preset: CuneiformBasic>, <Preset: Evaluation Test>, <Preset: OcropusBasic>, <Preset: SegmentTest>, <Preset: SwitchTest>, <Preset: TesseractBasic>]""")
        self.assertEqual(unicode(r.context["LANGUAGES"]), u"""(('ar', 'Arabic'), ('az', 'Azerbaijani'), ('bg', 'Bulgarian'), ('bn', 'Bengali'), ('bs', 'Bosnian'), ('ca', 'Catalan'), ('cs', 'Czech'), ('cy', 'Welsh'), ('da', 'Danish'), ('de', 'German'), ('el', 'Greek'), ('en', 'English'), ('en-gb', 'British English'), ('es', 'Spanish'), ('es-ar', 'Argentinian Spanish'), ('es-mx', 'Mexican Spanish'), ('es-ni', 'Nicaraguan Spanish'), ('et', 'Estonian'), ('eu', 'Basque'), ('fa', 'Persian'), ('fi', 'Finnish'), ('fr', 'French'), ('fy-nl', 'Frisian'), ('ga', 'Irish'), ('gl', 'Galician'), ('he', 'Hebrew'), ('hi', 'Hindi'), ('hr', 'Croatian'), ('hu', 'Hungarian'), ('id', 'Indonesian'), ('is', 'Icelandic'), ('it', 'Italian'), ('ja', 'Japanese'), ('ka', 'Georgian'), ('km', 'Khmer'), ('kn', 'Kannada'), ('ko', 'Korean'), ('lt', 'Lithuanian'), ('lv', 'Latvian'), ('mk', 'Macedonian'), ('ml', 'Malayalam'), ('mn', 'Mongolian'), ('nl', 'Dutch'), ('no', 'Norwegian'), ('nb', 'Norwegian Bokmal'), ('nn', 'Norwegian Nynorsk'), ('pa', 'Punjabi'), ('pl', 'Polish'), ('pt', 'Portuguese'), ('pt-br', 'Brazilian Portuguese'), ('ro', 'Romanian'), ('ru', 'Russian'), ('sk', 'Slovak'), ('sl', 'Slovenian'), ('sq', 'Albanian'), ('sr', 'Serbian'), ('sr-latn', 'Serbian Latin'), ('sv', 'Swedish'), ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'), ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('ur', 'Urdu'), ('vi', 'Vietnamese'), ('zh-cn', 'Simplified Chinese'), ('zh-tw', 'Traditional Chinese'))""")
        self.assertEqual(unicode(r.context["page_obj"]), u"""<Page 1 of 1>""")
        self.assertEqual(unicode(r.context["page_name"]), u"""OCR Presets""")
        self.assertEqual(unicode(r.context["user"]), u"""AnonymousUser""")
        self.assertEqual(unicode(r.context["model"]), u"""<class 'presets.models.Preset'>""")
        self.assertEqual(unicode(r.context["is_paginated"]), u"""False""")
        self.assertEqual(unicode(r.context["order"]), u"""name""")
        self.assertEqual(unicode(r.context["LANGUAGE_BIDI"]), u"""False""")
        self.assertEqual(unicode(r.context["MEDIA_URL"]), u"""/media/""")
    def test_staticcssgenericcss_13101687559(self):
        r = self.client.get('/static/css/generic.css', {})
        self.assertEqual(r.status_code, 200)
    def test_presetsshowcuneiformbasic_131016875901(self):
        r = self.client.get('/presets/show/cuneiformbasic/', {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(unicode(r.context["media"]), u"""screen""")
        self.assertEqual(unicode(r.context["fields"]), u"""['name', 'description', 'user', 'public', 'profile', 'tags', 'created_on', 'updated_on']""")
        self.assertEqual(unicode(r.context["object"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["LANGUAGES"]), u"""(('ar', 'Arabic'), ('az', 'Azerbaijani'), ('bg', 'Bulgarian'), ('bn', 'Bengali'), ('bs', 'Bosnian'), ('ca', 'Catalan'), ('cs', 'Czech'), ('cy', 'Welsh'), ('da', 'Danish'), ('de', 'German'), ('el', 'Greek'), ('en', 'English'), ('en-gb', 'British English'), ('es', 'Spanish'), ('es-ar', 'Argentinian Spanish'), ('es-mx', 'Mexican Spanish'), ('es-ni', 'Nicaraguan Spanish'), ('et', 'Estonian'), ('eu', 'Basque'), ('fa', 'Persian'), ('fi', 'Finnish'), ('fr', 'French'), ('fy-nl', 'Frisian'), ('ga', 'Irish'), ('gl', 'Galician'), ('he', 'Hebrew'), ('hi', 'Hindi'), ('hr', 'Croatian'), ('hu', 'Hungarian'), ('id', 'Indonesian'), ('is', 'Icelandic'), ('it', 'Italian'), ('ja', 'Japanese'), ('ka', 'Georgian'), ('km', 'Khmer'), ('kn', 'Kannada'), ('ko', 'Korean'), ('lt', 'Lithuanian'), ('lv', 'Latvian'), ('mk', 'Macedonian'), ('ml', 'Malayalam'), ('mn', 'Mongolian'), ('nl', 'Dutch'), ('no', 'Norwegian'), ('nb', 'Norwegian Bokmal'), ('nn', 'Norwegian Nynorsk'), ('pa', 'Punjabi'), ('pl', 'Polish'), ('pt', 'Portuguese'), ('pt-br', 'Brazilian Portuguese'), ('ro', 'Romanian'), ('ru', 'Russian'), ('sk', 'Slovak'), ('sl', 'Slovenian'), ('sq', 'Albanian'), ('sr', 'Serbian'), ('sr-latn', 'Serbian Latin'), ('sv', 'Swedish'), ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'), ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('ur', 'Urdu'), ('vi', 'Vietnamese'), ('zh-cn', 'Simplified Chinese'), ('zh-tw', 'Traditional Chinese'))""")
        self.assertEqual(unicode(r.context["preset"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["page_name"]), u"""OCR Preset""")
        self.assertEqual(unicode(r.context["user"]), u"""AnonymousUser""")
        self.assertEqual(unicode(r.context["LANGUAGE_BIDI"]), u"""False""")
        self.assertEqual(unicode(r.context["MEDIA_URL"]), u"""/media/""")
    def test_presetseditcuneiformbasic_131016876156(self):
        r = self.client.get('/presets/edit/cuneiformbasic/', {})
        self.assertEqual(r.status_code, 302)
    def test_presetsshowcuneiformbasic_131016877426(self):
        r = self.client.get('/presets/show/cuneiformbasic/', {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(unicode(r.context["media"]), u"""screen""")
        self.assertEqual(unicode(r.context["fields"]), u"""['name', 'description', 'user', 'public', 'profile', 'tags', 'created_on', 'updated_on']""")
        self.assertEqual(unicode(r.context["object"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["LANGUAGES"]), u"""(('ar', 'Arabic'), ('az', 'Azerbaijani'), ('bg', 'Bulgarian'), ('bn', 'Bengali'), ('bs', 'Bosnian'), ('ca', 'Catalan'), ('cs', 'Czech'), ('cy', 'Welsh'), ('da', 'Danish'), ('de', 'German'), ('el', 'Greek'), ('en', 'English'), ('en-gb', 'British English'), ('es', 'Spanish'), ('es-ar', 'Argentinian Spanish'), ('es-mx', 'Mexican Spanish'), ('es-ni', 'Nicaraguan Spanish'), ('et', 'Estonian'), ('eu', 'Basque'), ('fa', 'Persian'), ('fi', 'Finnish'), ('fr', 'French'), ('fy-nl', 'Frisian'), ('ga', 'Irish'), ('gl', 'Galician'), ('he', 'Hebrew'), ('hi', 'Hindi'), ('hr', 'Croatian'), ('hu', 'Hungarian'), ('id', 'Indonesian'), ('is', 'Icelandic'), ('it', 'Italian'), ('ja', 'Japanese'), ('ka', 'Georgian'), ('km', 'Khmer'), ('kn', 'Kannada'), ('ko', 'Korean'), ('lt', 'Lithuanian'), ('lv', 'Latvian'), ('mk', 'Macedonian'), ('ml', 'Malayalam'), ('mn', 'Mongolian'), ('nl', 'Dutch'), ('no', 'Norwegian'), ('nb', 'Norwegian Bokmal'), ('nn', 'Norwegian Nynorsk'), ('pa', 'Punjabi'), ('pl', 'Polish'), ('pt', 'Portuguese'), ('pt-br', 'Brazilian Portuguese'), ('ro', 'Romanian'), ('ru', 'Russian'), ('sk', 'Slovak'), ('sl', 'Slovenian'), ('sq', 'Albanian'), ('sr', 'Serbian'), ('sr-latn', 'Serbian Latin'), ('sv', 'Swedish'), ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'), ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('ur', 'Urdu'), ('vi', 'Vietnamese'), ('zh-cn', 'Simplified Chinese'), ('zh-tw', 'Traditional Chinese'))""")
        self.assertEqual(unicode(r.context["preset"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["page_name"]), u"""OCR Preset""")
        self.assertEqual(unicode(r.context["user"]), u"""AnonymousUser""")
        self.assertEqual(unicode(r.context["LANGUAGE_BIDI"]), u"""False""")
        self.assertEqual(unicode(r.context["MEDIA_URL"]), u"""/media/""")
    def test_presetsdeletecuneiformbasic_13101687797(self):
        r = self.client.get('/presets/delete/cuneiformbasic/', {})
        self.assertEqual(r.status_code, 302)
    def test_presetsshowcuneiformbasic_131016878162(self):
        r = self.client.get('/presets/show/cuneiformbasic/', {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(unicode(r.context["media"]), u"""screen""")
        self.assertEqual(unicode(r.context["fields"]), u"""['name', 'description', 'user', 'public', 'profile', 'tags', 'created_on', 'updated_on']""")
        self.assertEqual(unicode(r.context["object"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["LANGUAGES"]), u"""(('ar', 'Arabic'), ('az', 'Azerbaijani'), ('bg', 'Bulgarian'), ('bn', 'Bengali'), ('bs', 'Bosnian'), ('ca', 'Catalan'), ('cs', 'Czech'), ('cy', 'Welsh'), ('da', 'Danish'), ('de', 'German'), ('el', 'Greek'), ('en', 'English'), ('en-gb', 'British English'), ('es', 'Spanish'), ('es-ar', 'Argentinian Spanish'), ('es-mx', 'Mexican Spanish'), ('es-ni', 'Nicaraguan Spanish'), ('et', 'Estonian'), ('eu', 'Basque'), ('fa', 'Persian'), ('fi', 'Finnish'), ('fr', 'French'), ('fy-nl', 'Frisian'), ('ga', 'Irish'), ('gl', 'Galician'), ('he', 'Hebrew'), ('hi', 'Hindi'), ('hr', 'Croatian'), ('hu', 'Hungarian'), ('id', 'Indonesian'), ('is', 'Icelandic'), ('it', 'Italian'), ('ja', 'Japanese'), ('ka', 'Georgian'), ('km', 'Khmer'), ('kn', 'Kannada'), ('ko', 'Korean'), ('lt', 'Lithuanian'), ('lv', 'Latvian'), ('mk', 'Macedonian'), ('ml', 'Malayalam'), ('mn', 'Mongolian'), ('nl', 'Dutch'), ('no', 'Norwegian'), ('nb', 'Norwegian Bokmal'), ('nn', 'Norwegian Nynorsk'), ('pa', 'Punjabi'), ('pl', 'Polish'), ('pt', 'Portuguese'), ('pt-br', 'Brazilian Portuguese'), ('ro', 'Romanian'), ('ru', 'Russian'), ('sk', 'Slovak'), ('sl', 'Slovenian'), ('sq', 'Albanian'), ('sr', 'Serbian'), ('sr-latn', 'Serbian Latin'), ('sv', 'Swedish'), ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'), ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('ur', 'Urdu'), ('vi', 'Vietnamese'), ('zh-cn', 'Simplified Chinese'), ('zh-tw', 'Traditional Chinese'))""")
        self.assertEqual(unicode(r.context["preset"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["page_name"]), u"""OCR Preset""")
        self.assertEqual(unicode(r.context["user"]), u"""AnonymousUser""")
        self.assertEqual(unicode(r.context["LANGUAGE_BIDI"]), u"""False""")
        self.assertEqual(unicode(r.context["MEDIA_URL"]), u"""/media/""")
    def test_presetslist_13101687835(self):
        r = self.client.get('/presets/list/', {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(unicode(r.context["media"]), u"""screen""")
        self.assertEqual(unicode(r.context["preset_list"]), u"""[<Preset: CuneiformBasic>, <Preset: Evaluation Test>, <Preset: OcropusBasic>, <Preset: SegmentTest>, <Preset: SwitchTest>, <Preset: TesseractBasic>]""")
        self.assertEqual(unicode(r.context["fields"]), u"""['name', 'description', 'user', 'created_on']""")
        self.assertEqual(unicode(r.context["object_list"]), u"""[<Preset: CuneiformBasic>, <Preset: Evaluation Test>, <Preset: OcropusBasic>, <Preset: SegmentTest>, <Preset: SwitchTest>, <Preset: TesseractBasic>]""")
        self.assertEqual(unicode(r.context["LANGUAGES"]), u"""(('ar', 'Arabic'), ('az', 'Azerbaijani'), ('bg', 'Bulgarian'), ('bn', 'Bengali'), ('bs', 'Bosnian'), ('ca', 'Catalan'), ('cs', 'Czech'), ('cy', 'Welsh'), ('da', 'Danish'), ('de', 'German'), ('el', 'Greek'), ('en', 'English'), ('en-gb', 'British English'), ('es', 'Spanish'), ('es-ar', 'Argentinian Spanish'), ('es-mx', 'Mexican Spanish'), ('es-ni', 'Nicaraguan Spanish'), ('et', 'Estonian'), ('eu', 'Basque'), ('fa', 'Persian'), ('fi', 'Finnish'), ('fr', 'French'), ('fy-nl', 'Frisian'), ('ga', 'Irish'), ('gl', 'Galician'), ('he', 'Hebrew'), ('hi', 'Hindi'), ('hr', 'Croatian'), ('hu', 'Hungarian'), ('id', 'Indonesian'), ('is', 'Icelandic'), ('it', 'Italian'), ('ja', 'Japanese'), ('ka', 'Georgian'), ('km', 'Khmer'), ('kn', 'Kannada'), ('ko', 'Korean'), ('lt', 'Lithuanian'), ('lv', 'Latvian'), ('mk', 'Macedonian'), ('ml', 'Malayalam'), ('mn', 'Mongolian'), ('nl', 'Dutch'), ('no', 'Norwegian'), ('nb', 'Norwegian Bokmal'), ('nn', 'Norwegian Nynorsk'), ('pa', 'Punjabi'), ('pl', 'Polish'), ('pt', 'Portuguese'), ('pt-br', 'Brazilian Portuguese'), ('ro', 'Romanian'), ('ru', 'Russian'), ('sk', 'Slovak'), ('sl', 'Slovenian'), ('sq', 'Albanian'), ('sr', 'Serbian'), ('sr-latn', 'Serbian Latin'), ('sv', 'Swedish'), ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'), ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('ur', 'Urdu'), ('vi', 'Vietnamese'), ('zh-cn', 'Simplified Chinese'), ('zh-tw', 'Traditional Chinese'))""")
        self.assertEqual(unicode(r.context["page_obj"]), u"""<Page 1 of 1>""")
        self.assertEqual(unicode(r.context["page_name"]), u"""OCR Presets""")
        self.assertEqual(unicode(r.context["user"]), u"""AnonymousUser""")
        self.assertEqual(unicode(r.context["model"]), u"""<class 'presets.models.Preset'>""")
        self.assertEqual(unicode(r.context["is_paginated"]), u"""False""")
        self.assertEqual(unicode(r.context["order"]), u"""name""")
        self.assertEqual(unicode(r.context["LANGUAGE_BIDI"]), u"""False""")
        self.assertEqual(unicode(r.context["MEDIA_URL"]), u"""/media/""")
    def test_presetsshowcuneiformbasic_131016879459(self):
        r = self.client.get('/presets/show/cuneiformbasic/', {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(unicode(r.context["media"]), u"""screen""")
        self.assertEqual(unicode(r.context["fields"]), u"""['name', 'description', 'user', 'public', 'profile', 'tags', 'created_on', 'updated_on']""")
        self.assertEqual(unicode(r.context["object"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["LANGUAGES"]), u"""(('ar', 'Arabic'), ('az', 'Azerbaijani'), ('bg', 'Bulgarian'), ('bn', 'Bengali'), ('bs', 'Bosnian'), ('ca', 'Catalan'), ('cs', 'Czech'), ('cy', 'Welsh'), ('da', 'Danish'), ('de', 'German'), ('el', 'Greek'), ('en', 'English'), ('en-gb', 'British English'), ('es', 'Spanish'), ('es-ar', 'Argentinian Spanish'), ('es-mx', 'Mexican Spanish'), ('es-ni', 'Nicaraguan Spanish'), ('et', 'Estonian'), ('eu', 'Basque'), ('fa', 'Persian'), ('fi', 'Finnish'), ('fr', 'French'), ('fy-nl', 'Frisian'), ('ga', 'Irish'), ('gl', 'Galician'), ('he', 'Hebrew'), ('hi', 'Hindi'), ('hr', 'Croatian'), ('hu', 'Hungarian'), ('id', 'Indonesian'), ('is', 'Icelandic'), ('it', 'Italian'), ('ja', 'Japanese'), ('ka', 'Georgian'), ('km', 'Khmer'), ('kn', 'Kannada'), ('ko', 'Korean'), ('lt', 'Lithuanian'), ('lv', 'Latvian'), ('mk', 'Macedonian'), ('ml', 'Malayalam'), ('mn', 'Mongolian'), ('nl', 'Dutch'), ('no', 'Norwegian'), ('nb', 'Norwegian Bokmal'), ('nn', 'Norwegian Nynorsk'), ('pa', 'Punjabi'), ('pl', 'Polish'), ('pt', 'Portuguese'), ('pt-br', 'Brazilian Portuguese'), ('ro', 'Romanian'), ('ru', 'Russian'), ('sk', 'Slovak'), ('sl', 'Slovenian'), ('sq', 'Albanian'), ('sr', 'Serbian'), ('sr-latn', 'Serbian Latin'), ('sv', 'Swedish'), ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'), ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('ur', 'Urdu'), ('vi', 'Vietnamese'), ('zh-cn', 'Simplified Chinese'), ('zh-tw', 'Traditional Chinese'))""")
        self.assertEqual(unicode(r.context["preset"]), u"""CuneiformBasic""")
        self.assertEqual(unicode(r.context["page_name"]), u"""OCR Preset""")
        self.assertEqual(unicode(r.context["user"]), u"""AnonymousUser""")
        self.assertEqual(unicode(r.context["LANGUAGE_BIDI"]), u"""False""")
        self.assertEqual(unicode(r.context["MEDIA_URL"]), u"""/media/""")
    def test_presetslist_131016879738(self):
        r = self.client.get('/presets/list/', {})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(unicode(r.context["media"]), u"""screen""")
        self.assertEqual(unicode(r.context["preset_list"]), u"""[<Preset: CuneiformBasic>, <Preset: Evaluation Test>, <Preset: OcropusBasic>, <Preset: SegmentTest>, <Preset: SwitchTest>, <Preset: TesseractBasic>]""")
        self.assertEqual(unicode(r.context["fields"]), u"""['name', 'description', 'user', 'created_on']""")
        self.assertEqual(unicode(r.context["object_list"]), u"""[<Preset: CuneiformBasic>, <Preset: Evaluation Test>, <Preset: OcropusBasic>, <Preset: SegmentTest>, <Preset: SwitchTest>, <Preset: TesseractBasic>]""")
        self.assertEqual(unicode(r.context["LANGUAGES"]), u"""(('ar', 'Arabic'), ('az', 'Azerbaijani'), ('bg', 'Bulgarian'), ('bn', 'Bengali'), ('bs', 'Bosnian'), ('ca', 'Catalan'), ('cs', 'Czech'), ('cy', 'Welsh'), ('da', 'Danish'), ('de', 'German'), ('el', 'Greek'), ('en', 'English'), ('en-gb', 'British English'), ('es', 'Spanish'), ('es-ar', 'Argentinian Spanish'), ('es-mx', 'Mexican Spanish'), ('es-ni', 'Nicaraguan Spanish'), ('et', 'Estonian'), ('eu', 'Basque'), ('fa', 'Persian'), ('fi', 'Finnish'), ('fr', 'French'), ('fy-nl', 'Frisian'), ('ga', 'Irish'), ('gl', 'Galician'), ('he', 'Hebrew'), ('hi', 'Hindi'), ('hr', 'Croatian'), ('hu', 'Hungarian'), ('id', 'Indonesian'), ('is', 'Icelandic'), ('it', 'Italian'), ('ja', 'Japanese'), ('ka', 'Georgian'), ('km', 'Khmer'), ('kn', 'Kannada'), ('ko', 'Korean'), ('lt', 'Lithuanian'), ('lv', 'Latvian'), ('mk', 'Macedonian'), ('ml', 'Malayalam'), ('mn', 'Mongolian'), ('nl', 'Dutch'), ('no', 'Norwegian'), ('nb', 'Norwegian Bokmal'), ('nn', 'Norwegian Nynorsk'), ('pa', 'Punjabi'), ('pl', 'Polish'), ('pt', 'Portuguese'), ('pt-br', 'Brazilian Portuguese'), ('ro', 'Romanian'), ('ru', 'Russian'), ('sk', 'Slovak'), ('sl', 'Slovenian'), ('sq', 'Albanian'), ('sr', 'Serbian'), ('sr-latn', 'Serbian Latin'), ('sv', 'Swedish'), ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'), ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('ur', 'Urdu'), ('vi', 'Vietnamese'), ('zh-cn', 'Simplified Chinese'), ('zh-tw', 'Traditional Chinese'))""")
        self.assertEqual(unicode(r.context["page_obj"]), u"""<Page 1 of 1>""")
        self.assertEqual(unicode(r.context["page_name"]), u"""OCR Presets""")
        self.assertEqual(unicode(r.context["user"]), u"""AnonymousUser""")
        self.assertEqual(unicode(r.context["model"]), u"""<class 'presets.models.Preset'>""")
        self.assertEqual(unicode(r.context["is_paginated"]), u"""False""")
        self.assertEqual(unicode(r.context["order"]), u"""name""")
        self.assertEqual(unicode(r.context["LANGUAGE_BIDI"]), u"""False""")
        self.assertEqual(unicode(r.context["MEDIA_URL"]), u"""/media/""")
    def test_presetsbuilder_13101688024(self):
        r = self.client.get('/presets/builder/', {})
        self.assertEqual(r.status_code, 302)
    def test_presetsquery_131016880277(self):
        r = self.client.get('/presets/query/', {})
        self.assertEqual(r.status_code, 200)
    def test_presetslayout_graph_131016880292(self):
        r = self.client.post('/presets/layout_graph', {'script': '{}', })
    def test_staticcsscustom_themeimagesui_icons_454545_256x240png_13101688043(self):
        r = self.client.get('/static/css/custom-theme/images/ui-icons_454545_256x240.png', {})
        self.assertEqual(r.status_code, 200)
    def test_presetslist_131016880551(self):
        r = self.client.get('/presets/list/', {'format': 'json', })
        self.assertEqual(r.status_code, 200)
    def test_staticcsscustom_themeimagesui_bg_flat_0_aaaaaa_40x100png_13101688056(self):
        r = self.client.get('/static/css/custom-theme/images/ui-bg_flat_0_aaaaaa_40x100.png', {})
        self.assertEqual(r.status_code, 200)
    def test_presetsdatacuneiformbasic_131016880844(self):
        r = self.client.get('/presets/data/cuneiformbasic', {'format': 'json', })
        self.assertEqual(r.status_code, 200)

        
