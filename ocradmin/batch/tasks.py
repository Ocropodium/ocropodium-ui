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
from ocradmin.projects.models import Project



@register_handlers
class DocBatchScriptTask(AbortableTask):
    name = "run.batchitem"

    def run(self, project_pk, pid, scriptjson):
        """
        Runs the convert action.
        """
        doc = Project.objects.get(pk=project_pk).get_storage().get(pid)
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
            doc.script_content = json.dumps(tree.serialize(), indent=2)
            doc.save()
            [t.eval() for t in tree.get_terminals()]
        except exceptions.NodeError, err:
            logger.error("Ocropus Node Error (%s): %s", err.node, err.message)
        except Exception, err:
            logger.error("Unhandled exception: %s", err)
        return dict(done="Oh, yes")
            

