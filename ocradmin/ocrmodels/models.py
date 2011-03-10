from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField
import tagging
# OCR model, erm, model


class OcrModel(models.Model):
    """
        OCR model objects.
    """
    user = models.ForeignKey(User)
    derived_from = models.ForeignKey("self", null=True, blank=True)
    tags = TagField()
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)
    created_on = models.DateField(auto_now_add=True)
    updated_on = models.DateField(null=True, blank=True)
    public = models.BooleanField(default=True)
    file = models.FileField(upload_to="models")
    type = models.CharField(max_length=20,
            choices=[("char", "Character"), ("lang", "Language")])
    app = models.CharField(max_length=20,
            choices=[("ocropus", "Ocropus"), ("tesseract", "Tesseract")])

    def __unicode__(self):
        """
        String representation.
        """
        return "<%s: %s>" % (self.__class__.__name__, self.name)


