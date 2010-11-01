import os
from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrpresets.models import OcrPreset

from ocradmin.ocr import utils as ocrutils


class OcrProject(models.Model):
    """
    OCR Project model.
    """
    user = models.ForeignKey(User)
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    tags = TagField()
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    defaults = models.OneToOneField("OcrProjectDefaults", null=True, blank=True)

    def __unicode__(self):
        """
        String representation.
        """
        return self.name

class OcrProjectDefaults(models.Model):
    """
    OCR Project Defaults.  This is something of a 
    meta-preset.
    """
    lmodel = models.ForeignKey(OcrModel, blank=True, null=True, 
            related_name="lmodel", limit_choices_to={"type": "lang"})
    cmodel = models.ForeignKey(OcrModel, blank=True, null=True,
            related_name="cmodel", limit_choices_to={"type": "char"})
    binarizer = models.ForeignKey(OcrPreset, blank=True, null=True,
            related_name="binarizer", limit_choices_to={"type": "binarize"})
    psegmenter = models.ForeignKey(OcrPreset, blank=True, null=True,
            related_name="psegmenter", limit_choices_to={"type": "segment"})
    recognizer = models.ForeignKey(OcrPreset, blank=True, null=True,
            related_name="recognizer", limit_choices_to={"type": "recognize"})



    
