"""
Run plugin tasks on the Celery queue
"""
import os
import glob
from datetime import datetime, timedelta
from celery.contrib.abortable import AbortableTask
from celery.task import PeriodicTask
from django.core.exceptions import ImproperlyConfigured
from django.conf import settings
from django.utils import simplejson as json
from django.contrib.auth.models import User

from ocradmin.core import utils
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.nodelib import cache, types, nodes
from ocradmin.nodelib import utils as pluginutils

from nodetree import node, script, exceptions
import numpy


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
            tree = script.Script(nodelist,
                    nodekwargs=dict(logger=logger, cacher=cacher))
            term = tree.get_node(evalnode)
            if term is None:
                term = tree.get_terminals()[0]
            result = term.eval()
        except exceptions.NodeError, err:
            logger.error("Node Error (%s): %s", err.node, err.message)
            return dict(type="error", node=err.node.label, error=err.message)

        return self.handle_output(term, cacher, result)


    def handle_output(self, term, cacher, result):

        # special case for switches
        if term.__class__.__name__ == "Switch":
            return self.handle_output(term.first_active(), cacher, result)

        outpath = cacher.get_path(term.first_active())
        outname = term.first_active().get_file_name()
        outdzi = utils.media_path_to_url(
                os.path.join(outpath, "%s.dzi" % os.path.splitext(outname)[0]))
        indzi = None
        if term.arity > 0 and term.input(0):
            inpath = cacher.get_path(term.input(0).first_active())
            inname = term.input(0).first_active().get_file_name()
            indzi = utils.media_path_to_url(
                    os.path.join(inpath, "%s.dzi" % os.path.splitext(inname)[0]))

        if term.outtype == numpy.ndarray:
            out = dict(type="image", output=outdzi)
            if indzi is not None:
                out["input"] = indzi
            return out
        elif term.outtype == dict:
            result.update(type="pseg", input=indzi)
            return result
        elif term.outtype == types.HocrString:
            return dict(type="hocr", data=result)
        elif issubclass(term.outtype, basestring):
            return dict(type="text", data=result)



@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"


class PruneCacheTask(PeriodicTask):
    """
    Periodically prune a user's cache directory by deleting
    node cache's (oldest first) till the dir is under
    NODETREE_USER_MAX_CACHE size.
    """
    name = "cleanup.cache"
    run_every = timedelta(seconds=600)
    relative = True
    ignore_result = True

    def run(self, **kwargs):
        """
        Clean the modia folder of any files that haven't
        been accessed for X minutes.
        """
        logger = self.get_logger()
        cacheclass = pluginutils.get_dzi_cacher(settings)
        for user in User.objects.all():
            cachedir = "cache_%s" % user.username
            cacher = cacheclass(
                    path=os.path.join(settings.MEDIA_ROOT, settings.TEMP_PATH),
                    key=cachedir, logger=logger)
            logger.debug("Using cacher: %s, Bases %s", cacher, cacheclass.__bases__)




