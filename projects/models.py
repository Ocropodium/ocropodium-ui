from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField

from ocradmin.ocrmodels.model import OcrModel
from ocradmin.ocrpresets.model import OcrPreset

class Project(models.Model):
    """
    OCR Project model.
    """
    user = models.ForeignKey(User)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    tags = TagField()
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    defaults = models.OneToOneField("ProjectDefaults", null=True, blank=True)


class ProjectDefaults(models.Model):
    """
    OCR Project Defaults.  This is something of a 
    meta-preset.
    """
    default_lmodel = models.ForeignKey(OcrModel, blank=True, null=True)
    default_cmodel = models.ForeignKey(OcrModel, blank=True, null=True)
    default_binarizer = models.ForeignKey(OcrPreset, blank=True, null=True)
    default_psegmenter = models.ForeignKey(OcrPreset, blank=True, null=True)
    default_recognizer = models.ForeignKey(OcrPreset, blank=True, null=True)


