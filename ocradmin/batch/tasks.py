"""
Celery tasks for Batch operations.
"""

import os
import glob
from celery.contrib.abortable import AbortableTask
from celery.task.sets import subtask
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.ocrtasks.utils import get_progress_callback, get_abort_callback
from django.utils import simplejson as json

from nodetree import cache, node, script, exceptions
from django.conf import settings
from ocradmin.nodelib import stages, nodes



@register_handlers
class BatchScriptTask(AbortableTask):
    name = "run.batchitem"

    def run(self, filepath, scriptjson, writepath, callback=None):
        """
        Runs the convert action.
        """
        logger = self.get_logger()
        logger.debug("Running Batch with callback: %s", callback)
        progress_handler = get_progress_callback(self.request.id)
        abort_handler = get_abort_callback(self.request.id)
        progress_handler(0)

        tree = script.Script(json.loads(scriptjson),
                nodekwargs=dict(
                    logger=logger,
                    abort_func=abort_handler,
                    progress_func=progress_handler))
        logger.debug("Running tree: %s", json.dumps(tree.serialize(), indent=2))
        term = [t for t in tree.get_terminals() if t.label != "OutputBinary"][0]
        outbin = tree.get_node("OutputBinary")
        try:
            # write out the binary... this should cache it's input
            os.environ["NODETREE_WRITE_FILEOUT"] = "1"
            outbin.eval()
            result = term.eval()
            if callback is not None:
                subtask(callback).delay(result)
            return result
        except exceptions.NodeError, err:
            logger.error("Ocropus Node Error (%s): %s", err.node, err.message)
            return dict(type="error", node=err.node.label, error=err.message)
        except Exception, err:
            logger.error("Unhandled exception: %s", err)
            return dict(error=err.message)


@register_handlers
class DocBatchScriptTask(AbortableTask):
    name = "run.docbatchitem"

    def run(self, project_pk, pid, scriptjson):
        """
        Runs the convert action.
        """
        logger = self.get_logger()
        logger.debug("Running Document Batch Item: %s")
        progress_handler = get_progress_callback(self.request.id)
        abort_handler = get_abort_callback(self.request.id)
        progress_handler(0)

        tree = script.Script(json.loads(scriptjson),
                nodekwargs=dict(
                    logger=logger,
                    abort_func=abort_handler,
                    progress_func=progress_handler))
        logger.debug("Running tree: %s", json.dumps(tree.serialize(), indent=2))
        try:
            # write out the binary... this should cache it's input
            os.environ["NODETREE_WRITE_FILEOUT"] = "1"
            [t.eval() for t in tree.get_terminals()]
        except exceptions.NodeError, err:
            logger.error("Ocropus Node Error (%s): %s", err.node, err.message)
        except Exception, err:
            logger.error("Unhandled exception: %s", err)
        return dict(done="Oh, yes")
            

