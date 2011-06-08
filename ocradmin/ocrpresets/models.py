from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField
import tagging
import autoslug

class OcrPreset(models.Model):
    user = models.ForeignKey(User)
    tags = tagging.fields.TagField()
    name = models.CharField(max_length=100, unique=True)
    slug = autoslug.AutoSlugField(populate_from="name", unique=True)
    description = models.TextField(null=True, blank=True)
    public = models.BooleanField(default=True)
    created_on = models.DateField(auto_now_add=True)
    updated_on = models.DateField(null=True, blank=True, auto_now=True)
    data = models.TextField()

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/ocrpresets/list/"

    @classmethod
    def get_create_url(cls):
        """URL to create a new object"""
        return "/ocrpresets/create/"

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/ocrpresets/show/%s/" % self.slug

    def get_update_url(self):
        """url to update an object detail"""
        return "/ocrpresets/edit/%s/" % self.slug

    def get_delete_url(self):
        """url to update an object detail"""
        return "/ocrpresets/delete/%s/" % self.slug

    def __unicode__(self):
        """
        String representation.
        """
        return self.name
