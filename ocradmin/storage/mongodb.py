"""
Mongodb storage backend.
"""

from django import forms
from pymongo import Connection
import gridfs

from . import base

class ConfigForm(base.BaseConfigForm):
    """Mongodb config form."""


class MongoDbStorage(base.BaseStorage):
    """Mongodb storage backend."""

