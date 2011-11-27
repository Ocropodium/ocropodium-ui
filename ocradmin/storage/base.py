"""
Storage backend base class.
"""

import sys
import textwrap
from django import forms

from . import registry

class BaseConfigForm(forms.Form):
    """Base class for config form values."""
    namespace = forms.CharField(max_length=255)


class StorageType(type):
    """Storage metaclass. Registers each storage
    backend on initialisation."""
    def __new__(cls, name, bases, attrs):
        new = super(StorageType, cls).__new__
        store_module = attrs.get("__module__") or "__main__"

         # Abstract class: abstract attribute should not be inherited.
        if attrs.pop("abstract", None) or not attrs.get("autoregister", True):
            return new(cls, name, bases, attrs)

        # Automatically generate missing/empty name, description, arity.
        autoname = False
        if not attrs.get("name"):
            attrs["name"] = name
            autoname = True

        store_name = attrs["name"]
        if store_name not in registry.stores:
            storecls = new(cls, name, bases, attrs)

            if attrs.get("description") is None:
                doc = attrs.get("__doc__") or ""
                storecls.description = textwrap.dedent(doc).strip()
            registry.stores.register(storecls)
        return registry.stores[store_name]

    def __repr__(cls):
        return "<class Storage %s>" % cls.name
            

class BaseStorage(object):
    """Base class for document storage backends."""
    __metaclass__ = StorageType
    abstract = True

    configform = BaseConfigForm
    defaults = {}

    def __init__(self, *args, **kwargs):
        pass


