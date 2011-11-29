"""
Storage node interfaces.
"""

from __future__ import absolute_import

import os
import re
import codecs
import tempfile
import subprocess as sp
from cStringIO import StringIO
import hashlib

from nodetree import node, writable_node, exceptions

from . import base, util as utilnodes
from .. import stages, types, utils

from PIL import Image
import ocrolib

from ocradmin.projects.models import Project
from eulfedora.util import RequestFailed


class DocMixin(node.Node):
    """Base class for storage input interface."""
    parameters = [
            dict(name="project", value=""),
            dict(name="pid", value=""),
    ]

    def validate(self):
        project_pk = self._params.get("project")
        try:
            pk = int(project_pk)
        except ValueError:
            raise exceptions.ValidationError(
                    "Project primary key not set.", self)
        val = self._params.get("pid")
        if not val.strip():
            raise exceptions.ValidationError("Pid not set", self)
        super(DocMixin, self).validate()


class DocWriter(DocMixin, utilnodes.FileOut):
    """Base class for storage output interface."""    
    stage = stages.OUTPUT
    outtype = type(None)
    parameters = [
            dict(name="project", value=""),
            dict(name="pid", value=""),
            dict(
                name="attribute", value="image",
                choices=["image", "binary", "transcript"],
            )
    ]

    def validate(self):
        project_pk = self._params.get("project")
        try:
            pk = int(project_pk)
        except ValueError:
            raise exceptions.ValidationError(
                    "Project primary key not set.", self)
        val = self._params.get("pid")
        if not val.strip():
            raise exceptions.ValidationError("Pid not set", self)

    def process(self, input):
        # TODO: Make robust
        if input is None: # or not os.environ.get("NODETREE_WRITE_FILEOUT"):
            return input

        project = Project.objects.get(pk=self._params.get("project"))
        storage = project.get_storage()
        doc = storage.get(self._params.get("pid"))
        attr = self._params.get("attribute")

        # FIXME: More memory processing...
        memstream = StringIO()
        self._inputs[0].writer(memstream, input)        
        memstream.seek(0)
        self.logger.info("WRITING STREAM: %s to doc %s", attr, doc.pid)
        storage.set_document_attr_content(doc, attr, memstream)
        if attr == "image":
            doc.make_thumbnail()
        doc.save()
        return input


class DocImageFileIn(DocMixin, base.GrayPngWriterMixin):
    """Read an image file from doc storage."""
    stage = stages.INPUT
    intypes = []
    outtype = ocrolib.numpy.ndarray

    def process(self):
        # TODO: Make robust
        project = Project.objects.get(pk=self._params.get("project"))
        storage = project.get_storage()
        doc = storage.get(self._params.get("pid"))

        try:
            pil = Image.open(doc.image_content)
        except IOError:
            raise exceptions.NodeError(
                    "Error reading datastream contents as an image.", self)
        except RequestFailed:
            raise exceptions.NodeError(
                    "Error communicating with storage", self)
        return ocrolib.numpy.asarray(pil)


        
        


