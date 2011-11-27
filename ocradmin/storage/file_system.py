"""
Filesystem storage module.
"""

import os
from django import forms

from . import base, exceptions


class ConfigForm(base.BaseConfigForm):
    """File system storage config."""


class FileSystemStorage(base.BaseStorage):
    """Filesystem storage backend.  A document is represented
    as a directory of datastreams, i.e:
        <project-name>:1/
            IMG   -> simlink to simple_v1.png
            IMG_Binary.png
            versions/
                simple_v1.png
                transcript-1.html
                transcript-2.html

       Datastream id is the file basename minus the suffix.
    """

    configform = ConfigForm
