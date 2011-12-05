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
from ocradmin.documents import status


@register_handlers
class DocBatchScriptTask(AbortableTask):
    name = "run.batchitem"
    ignore_result = True

    def run(self, project_pk, pid, scriptjson):
        """
        Runs the convert action.
        """
        project = Project.objects.get(pk=project_pk)
        storage = project.get_storage()
        doc = storage.get(pid)
        logger = self.get_logger()
        logger.debug("Running Document Batch Item: %s")

        # try and delete the existing binary dzi file
        dzipath = storage.document_attr_dzi_path(doc, "binary")
        dzifiles = os.path.splitext(dzipath)[0] + "_files"
        try:
            os.unlink(dzipath)
            shutil.rmtree(dzifiles)
        except OSError:
            pass

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
            doc.script_label = "%s.json" % os.path.splitext(doc.label)[0]
            doc.script_mimetype = "application/json"
            # set document metadata to indicate it's an OCR "draft"
            doc.ocr_status = status.RUNNING
            doc.save()

            # process the nodes
            [t.eval() for t in tree.get_terminals()]

        except Exception, err:
            logger.exception("Unhandled exception: %s", err)
            # set document metadata to indicate it's an OCR "draft"
            doc.ocr_status = status.ERROR
        else:
            # set document metadata to indicate it's an OCR "draft"
            doc.ocr_status = status.UNCORRECTED
        finally:
            doc.save()
            

