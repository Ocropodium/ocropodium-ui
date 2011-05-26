"""
Run plugin tasks on the Celery queue
"""

import script

from celery.contrib.abortable import AbortableTask
from ocradmin.ocrtasks.decorators import register_handlers

class UnhandledRunScriptTask(AbortableTask):
    """
    Convert an image of text into some JSON.  This is done using
    the OcropusWrapper (and it's proxy, TessWrapper) in util.py.
    """
    name = "_run.script"
    max_retries = None

    def run(self, evalnode, nodelist, **kwargs):
        """
        Runs the convert action.
        """
        logger = self.get_logger()

        try:
            pl = script.Script(nodelist, logger=logger)
            term = pl.get_node(evalnode)
            val = term.eval()
            logger.debug("Val is: %s", val)
        except StandardError, err:
            raise
        logger.info(val)
        return val

@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"
