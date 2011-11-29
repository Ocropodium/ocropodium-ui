"""
Model to store script data.
"""

import json
import datetime
from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField
import tagging
import autoslug

from nodetree import script


class JsonTextField(models.TextField):
    def to_python(self, value):
        return value

    def validate(self, value, *args, **kwargs):
        super(models.TextField, self).validate(value, *args, **kwargs)
        try:
            json.loads(value)
        except ValueError:
            raise models.exceptions.ValidationError("Data must be valid JSON")


class Preset(models.Model):
    user = models.ForeignKey(User, related_name="presets")
    tags = tagging.fields.TagField()
    name = models.CharField(max_length=100, unique=True)
    slug = autoslug.AutoSlugField(populate_from="name", unique=True)
    description = models.TextField(blank=True)
    public = models.BooleanField(default=True)
    created_on = models.DateField(editable=False)
    updated_on = models.DateField(editable=False, null=True, blank=True)
    data = JsonTextField()
    profile = models.ForeignKey("Profile", related_name="presets",
            null=True, blank=True)

    def __unicode__(self):
        """
        String representation.
        """
        return self.name

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(Preset, self).save()

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/presets/show/%s/" % self.slug

    def get_update_url(self):
        """url to update an object detail"""
        return "/presets/edit/%s/" % self.slug

    def get_delete_url(self):
        """url to update an object detail"""
        return "/presets/delete/%s/" % self.slug

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/presets/list/"

    @classmethod
    def get_create_url(cls):
        """URL to create a new object"""
        return "/presets/create/"

TEST_PROFILE = {
    "must_exist" : [
        {
            "attr": "stage",
            "value": "recognize",
            "unique": False,
        },
        {
            "attr": "stage",
            "value": "input",
            "unique": True,
        },
    ],
}


class Profile(models.Model):
    """Preset profile.  This defines a class of
    presets to which the information in the preset
    must conform."""
    name = models.CharField(max_length=255)
    slug = autoslug.AutoSlugField(populate_from="name", unique=True)
    tags = tagging.fields.TagField()
    description = models.TextField(blank=True)
    created_on = models.DateField(editable=False)
    updated_on = models.DateField(editable=False, null=True, blank=True)
    data = JsonTextField()

    def __unicode__(self):
        """
        String representation.
        """
        return self.name

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(Profile, self).save()

    def validate_preset(self, data):
        this = json.loads(self.data)
        tree = script.Script(data)
        errors = []
        for name, preds in this.iteritems():
            for pred in preds:
                perrors = self.validate_predicate(name, pred, tree)
                if perrors:
                    errors.extend(perrors)
        return errors

    def validate_predicate(self, name, pred, tree):
        errors = []
        if name == "must_exist":
            attr = pred.get("attr")
            value = pred.get("value")
            unique = pred.get("unique")
            nodes = tree.get_nodes_by_attr(attr, value)
            if not nodes:
                errors.append("A node with attr '%s'='%s' must exist" % (attr, value))
            elif len(nodes) > 1:
                errors.append("Node with attr '%s'='%s' must be unique" % (attr, value))
        return errors

    def get_absolute_url(self):
        """URL to view an object detail"""
        return "/profiles/show/%s/" % self.slug

    def get_update_url(self):
        """url to update an object detail"""
        return "/profiles/edit/%s/" % self.slug

    def get_delete_url(self):
        """url to update an object detail"""
        return "/profiles/delete/%s/" % self.slug

    @classmethod
    def get_list_url(cls):
        """URL to view the object list"""
        return "/profiles/list/"

    @classmethod
    def get_create_url(cls):
        """URL to create a new object"""
        return "/profiles/create/"



