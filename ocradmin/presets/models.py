import datetime
from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField
import tagging
import autoslug

class Preset(models.Model):
    user = models.ForeignKey(User)
    tags = tagging.fields.TagField()
    name = models.CharField(max_length=100, unique=True)
    slug = autoslug.AutoSlugField(populate_from="name", unique=True)
    description = models.TextField(null=True, blank=True)
    public = models.BooleanField(default=True)
    created_on = models.DateField(editable=False)
    updated_on = models.DateField(editable=False, null=True, blank=True)
    data = models.TextField()

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(Preset, self).save()

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/presets/list/"

    @classmethod
    def get_create_url(cls):
        """URL to create a new object"""
        return "/presets/create/"

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/presets/show/%s/" % self.slug

    def get_update_url(self):
        """url to update an object detail"""
        return "/presets/edit/%s/" % self.slug

    def get_delete_url(self):
        """url to update an object detail"""
        return "/presets/delete/%s/" % self.slug

    def __unicode__(self):
        """
        String representation.
        """
        return self.name
