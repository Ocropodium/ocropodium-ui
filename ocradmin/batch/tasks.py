"""
Celery tasks for Batch operations.
"""

import os

from celery.contrib.abortable import AbortableTask
from celery.task.sets import subtask
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.ocrtasks.utils import get_progress_callback, get_abort_callback
from django.utils import simplejson as json

from nodetree import cache, node, script
from nodetree.manager import ModuleManager
from django.conf import settings
from ocradmin.plugins import ocropus_nodes, stages

manager = ModuleManager()
manager.register_module("ocradmin.plugins.ocropus_nodes")
manager.register_module("ocradmin.plugins.tesseract_nodes")
manager.register_module("ocradmin.plugins.cuneiform_nodes")
manager.register_module("ocradmin.plugins.abbyy_nodes")
manager.register_module("ocradmin.plugins.numpy_nodes")
manager.register_module("ocradmin.plugins.pil_nodes")


@register_handlers
class BatchScriptTask(AbortableTask):
    name = "run.batchitem"

    def run(self, filepath, scriptjson, writepath, callback=None, **kwargs):
        """
        Runs the convert action.
        """
        logger = self.get_logger()
        progress_handler = get_progress_callback(self.request.id)
        abort_handler = get_abort_callback(self.request.id)
        progress_handler(0)

        if not os.path.exists(writepath):
            os.makedirs(writepath, 0777)

        tree = script.Script(json.loads(scriptjson), manager=manager, 
                nodekwargs=dict(
                    logger=logger,
                    abort_func=abort_handler, 
                    progress_func=progress_handler))
        # get the input node and replace it with out path
        inputs = tree.get_nodes_by_attr("stage", stages.INPUT)
        if not inputs:
            raise IndexError("No input stages found in script")
        input = inputs[0]
        input.set_param("path", filepath)
        # attach a fileout node to the binary input of the recognizer and
        # save it as a binary file
        term = tree.get_terminals()[0]
        outpath = os.path.join(
                writepath, os.path.basename("%s.bin%s" % os.path.splitext(filepath)))
        outbin = manager.get_new_node("Ocropus::FileOut", label="OutputBinary",
                params=[("path", os.path.abspath(outpath).encode())])
        outbin.set_input(0, term.input(0))
        try:
            # write out the binary... this should cache it's input
            outbin.eval()
            result = term.eval()
            if callback is not None:
                subtask(callback).delay(result)
            return result
        except ocropus_nodes.OcropusNodeError, err:
            logger.error("Ocropus Node Error (%s): %s", err.node, err.message)
            return dict(type="error", node=err.node.label, error=err.msg)
        except Exception, err:
            logger.error("Unhandled exception: %s", err)
            return dict(error=err.message)
            
