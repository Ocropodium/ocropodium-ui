"""
Celery tasks for Batch operations.
"""

import os

from celery.contrib.abortable import AbortableTask
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.core import utils

from nodetree import cache, node, script
from nodetree.manager import ModuleManager
from django.conf import settings
from ocradmin.plugins import ocropus_nodes

manager = ModuleManager()
manager.register_module("ocradmin.plugins.ocropus_nodes")
manager.register_module("ocradmin.plugins.tesseract_nodes")
manager.register_module("ocradmin.plugins.cuneiform_nodes")
manager.register_module("ocradmin.plugins.numpy_nodes")
manager.register_module("ocradmin.plugins.pil_nodes")


@register_handlers
class BatchScriptTask(AbortableTask):
    name = "run.batch"
