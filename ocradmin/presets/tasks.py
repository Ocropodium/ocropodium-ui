"""
Run plugin tasks on the Celery queue
"""
import os
import glob
from celery.contrib.abortable import AbortableTask
from django.core.exceptions import ImproperlyConfigured
from django.conf import settings
from django.utils import simplejson as json

from ocradmin.core import utils
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.plugins import ocropus_nodes, cache, types
from ocradmin.plugins import utils as pluginutils

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

    def run(self, evalnode, nodelist, writepath, cachedir):
        """
        Runs the convert action.
        """
        logger = self.get_logger()
        cacheclass = pluginutils.get_dzi_cacher(settings)
        cacher = cacheclass(
                path=os.path.join(settings.MEDIA_ROOT, settings.TEMP_PATH), 
                key=cachedir, logger=logger)
        logger.debug("Using cacher: %s, Bases %s", cacher, cacheclass.__bases__)
        try:
            tree = script.Script(nodelist, manager=MANAGER, 
                    nodekwargs=dict(logger=logger, cacher=cacher))
            term = tree.get_node(evalnode)
            if term is None:
                term = tree.get_terminals()[0]
            result = term.eval()
        except node.NodeError, err:
            logger.error("Node Error (%s): %s", err.node, err.message)
            return dict(type="error", node=err.node.label, error=err.msg)

        path = cacher.get_path(term.first_active())
        filename = term.first_active().get_file_name()
        if term.outtype == numpy.ndarray:
            dzi = "%s.dzi" % os.path.splitext(filename)[0]
            return dict(
                type="image",
                path=utils.media_path_to_url(os.path.join(path, filename)),
                dzi=utils.media_path_to_url(os.path.join(path, dzi))
            )
        elif term.outtype == dict:
            path = cacher.get_path(term._inputs[0].first_active())
            filename = term._inputs[0].first_active().get_file_name()
            dzi = "%s.dzi" % os.path.splitext(filename)[0]
            dzipath=utils.media_path_to_url(os.path.join(path, dzi))
            result.update(type="pseg", dzi=dzipath)
            return result
        elif term.outtype == types.HocrString: 
            return dict(type="hocr", data=result)
        elif issubclass(term.outtype, basestring):
            return dict(type="text", data=result)



@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"
