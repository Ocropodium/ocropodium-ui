from django.db import models
from django.contrib.auth.models import User
from picklefield import fields
from tagging.fields import TagField
import tagging

class OcrPreset(models.Model):
    user = models.ForeignKey(User)
    tags = TagField()
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)
    public = models.BooleanField(default=True)
    created_on = models.DateField(auto_now_add=True)
    updated_on = models.DateField(null=True, blank=True, auto_now=True)
    type = models.CharField(max_length=20,
            choices=[("segment", "Segment"), ("binarize", "Binarize")])
    data = fields.PickledObjectField()

