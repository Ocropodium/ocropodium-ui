"""
Run plugin tasks on the Celery queue
"""

import os
import script

from celery.contrib.abortable import AbortableTask
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.core import utils

import json
import numpy
import hashlib
import bencode

from ocradmin.plugins import cache, node
import ocrolib
from django.conf import settings
from ocradmin.vendor import deepzoom

class UnsupportedNodeTypeError(StandardError):
    pass


class PersistantFileCacher(cache.BasicCacher):
    """
    Store data in files for persistance.
    """
    def __init__(self, path="", key="", **kwargs):
        super(PersistantFileCacher, self).__init__(**kwargs)
        self._key = key
        self._path = path

    def _read_node_data(self, path):
        """
        Get the file data under path and return it.
        """

        fname = os.listdir(path)[0] 
        if fname.endswith(".png"):
            self.logger.debug("Reading cache: %s" % os.path.join(path, fname))
            return ocrolib.read_image_gray(os.path.join(path, fname))
        elif fname.endswith(".json"):
            self.logger.debug("Reading cache: %s" % os.path.join(path, fname))
            with open(os.path.join(path, fname)) as f:
                return json.load(f)
        else:
            raise UnsupportedCacheTypeError(path)

    def _write_node_data(self, path, data):
        if not os.path.exists(path):
            os.makedirs(path, 0777)
        if isinstance(data, numpy.ndarray):
            self.logger.debug("Writing cache: %s" % os.path.join(path, "cache.png"))
            pngpath = os.path.join(path, "cache.png")
            ocrolib.write_image_gray(pngpath, data)
            creator = deepzoom.ImageCreator(tile_size=512,
                    tile_overlap=2, tile_format="png",
                    image_quality=1, resize_filter="nearest")
            creator.create(pngpath, "%s.dzi" % os.path.splitext(pngpath)[0])
        else:
            self.logger.debug("Writing cache: %s" % os.path.join(path, "cache.json"))
            with open(os.path.join(path, "cache.json"), "w") as f:
                json.dump(data, f)

    def get_path(self, n):
        hash = hashlib.md5(bencode.bencode(n.hash_value())).hexdigest()
        return os.path.join(self._path, self._key, n.name, hash)

    
    def get_cache(self, n):
        path = self.get_path(n)
        if os.path.exists(path):
            return self._read_node_data(path)
        
    def set_cache(self, n, data):
        self._write_node_data(self.get_path(n), data)

    def has_cache(self, n):
        return os.path.exists(self.get_path(n))



class UnhandledRunScriptTask(AbortableTask):
    """
    Convert an image of text into some JSON.  This is done using
    the OcropusWrapper (and it's proxy, TessWrapper) in util.py.
    """
    name = "_run.script"
    max_retries = None

    def run(self, evalnode, nodelist, writepath, **kwargs):
        """
        Runs the convert action.
        """
        logger = self.get_logger()
        cacher = PersistantFileCacher(
                path=os.path.join(settings.MEDIA_ROOT, settings.TEMP_PATH), 
                key="sessionkey", logger=logger)

        try:
            pl = script.Script(nodelist, nodekwargs=dict(logger=logger, cacher=cacher))
            term = pl.get_node(evalnode)
            if term is None:
                term = pl.get_terminals()[0]
            result = term.eval()
        except node.NodeError, err:
            raise
        if isinstance(result, numpy.ndarray):
            path = cacher.get_path(term.first_active())
            return dict(
                type="image",
                path=utils.media_path_to_url(os.path.join(path, "cache.png")),
                dzi=utils.media_path_to_url(os.path.join(path, "cache.dzi"))
            )
        else:
            return dict(
                type="text",
                data=result
            )

@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"
