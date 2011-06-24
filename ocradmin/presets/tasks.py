"""
Run plugin tasks on the Celery queue
"""
import os
import glob
from celery.contrib.abortable import AbortableTask
from django.conf import settings
from django.utils import simplejson as json

from ocradmin.core import utils
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.plugins import ocropus_nodes, cache

from nodetree import node, script
from nodetree.manager import ModuleManager
import numpy


MANAGER = ModuleManager()
MANAGER.register_paths(
                glob.glob("plugins/*_nodes.py"), root="ocradmin")


class UnhandledRunScriptTask(AbortableTask):
    """
    Convert an image of text into some JSON.  This is done using
    the OcropusWrapper (and it's proxy, TessWrapper) in util.py.
    """
    name = "_run.script"
    max_retries = None

    def run(self, evalnode, nodelist, writepath):
        """
        Runs the convert action.
        """
        logger = self.get_logger()
        cacher = cache.PersistantFileCacher(
                path=os.path.join(settings.MEDIA_ROOT, settings.TEMP_PATH), 
                key="sessionkey", logger=logger)

        try:
            tree = script.Script(nodelist, manager=MANAGER, 
                    nodekwargs=dict(logger=logger, cacher=cacher))
            term = tree.get_node(evalnode)
            if term is None:
                term = tree.get_terminals()[0]
            result = term.eval()
        except ocropus_nodes.OcropusNodeError, err:
            logger.error("Ocropus Node Error (%s): %s", err.node, err.message)
            return dict(type="error", node=err.node.label, error=err.msg)

        path = cacher.get_path(term.first_active())
        filename = term.first_active().get_file_name()
        if isinstance(result, numpy.ndarray):
            dzi = "%s.dzi" % os.path.splitext(filename)[0]
            return dict(
                type="image",
                path=utils.media_path_to_url(os.path.join(path, filename)),
                dzi=utils.media_path_to_url(os.path.join(path, dzi))
            )
        elif isinstance(result, dict):
            path = cacher.get_path(term._inputs[0].first_active())
            filename = term._inputs[0].first_active().get_file_name()
            dzi = "%s.dzi" % os.path.splitext(filename)[0]
            dzipath=utils.media_path_to_url(os.path.join(path, dzi))
            result.update(type="pseg", dzi=dzipath)
            return result
        else:
            parser = utils.HocrParser()
            return dict(type="text", data=parser.parse(result))


@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"
