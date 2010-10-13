from picklefield import fields
from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrpresets.models import OcrPreset


class OcrProject(models.Model):
    """
    OCR Project model.
    """
    user = models.ForeignKey(User)
    name = models.CharField(max_length=255, unique=True)
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


class ReferencePage(models.Model):
    """
    Single page of reference data, i.e: text lines
    with geometry and a corresponding binary
    image.
    """
    page_name = models.CharField(max_length=255)
    user = models.ForeignKey(User)
    project = models.ForeignKey(OcrProject, related_name="reference_sets")
    data = fields.PickledObjectField()
    source_image_path = models.CharField(max_length=255)
    binary_image_path = models.CharField(max_length=255)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    updated_on = models.DateTimeField(auto_now=True, editable=False)

    class Meta:
        unique_together = ("project", "binary_image_path")

    def binary_image_url(self):
        """
        Url to image resource.
        """
        return ocrutils.media_path_to_url(self.binary_image_path)

    def thumbnail_path(self):
        """
        Path to where the thumbnail should be.
        """
        return "%s.thumb.jpg" % os.path.splitext(self.binary_image_path)[0] 

    def thumbnail_url(self):
        """
        Url to thumbnail resource.
        """
        return ocrutils.media_path_to_url(self.thumbnail_path())


    
