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
import cache
import ocrolib


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
            ocrolib.write_image_gray(os.path.join(path, "cache.png"), data)
        else:
            self.logger.debug("Writing cache: %s" % os.path.join(path, "cache.json"))
            with open(os.path.join(path, "cache.json"), "w") as f:
                json.dump(data, f)

    def get_cache(self, node):
        hash = hashlib.md5(bencode.bencode(node.hash_value())).hexdigest()
        path = os.path.join(self._path, self._key, node.name, hash)
        if os.path.exists(path):
            return self._read_node_data(path)
        
    def set_cache(self, node, data):
        hash = hashlib.md5(bencode.bencode(node.hash_value())).hexdigest()
        # if the file already exists, return its data
        path = os.path.join(self._path, self._key, node.name, hash)
        self._write_node_data(path, data)

    def has_cache(self, node):
        hash = hashlib.md5(bencode.bencode(node.hash_value())).hexdigest()
        path = os.path.join(self._path, self._key, node.name, hash)
        return os.path.exists(path)



def save_nimage(fname, img):
    import ocrolib
    from ocradmin.vendor import deepzoom
    ocrolib.write_image_gray(fname.encode(), img)
    creator = deepzoom.ImageCreator(tile_size=512,
            tile_overlap=2, tile_format="png",
            image_quality=1, resize_filter="nearest")
    dzipath = "%s.dzi" % os.path.splitext(fname)[0]
    creator.create(fname, dzipath)
    return dzipath


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
        cacher = PersistantFileCacher(path="", key="foobar", logger=logger)

        try:
            pl = script.Script(nodelist, nodekwargs=dict(logger=logger, cacher=cacher))
            term = pl.get_node(evalnode)
            if term is None:
                term = pl.get_terminals()[0]
            result = term.eval()
        except StandardError, err:
            raise
        if isinstance(result, numpy.ndarray):            
            if not os.path.exists(writepath):
                os.makedirs(writepath, 0777)
            path = os.path.join(writepath, "output.png")
            dzi = save_nimage(path, result)
            result = dict(
                path=utils.media_path_to_url(path), 
                dzi=utils.media_path_to_url(dzi)
            )
        return result

@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"
