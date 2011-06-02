"""
Run plugin tasks on the Celery queue
"""

import os

from celery.contrib.abortable import AbortableTask
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.core import utils

import json
import numpy
import hashlib
import bencode

from nodetree import cache, node, script
from nodetree.manager import ModuleManager
import ocrolib
from django.conf import settings
from ocradmin.vendor import deepzoom

from ocradmin.plugins import ocropus_nodes

manager = ModuleManager()
manager.register_module("ocradmin.plugins.ocropus_nodes")
manager.register_module("ocradmin.plugins.tesseract_nodes")
manager.register_module("ocradmin.plugins.cuneiform_nodes")
manager.register_module("ocradmin.plugins.numpy_nodes")
manager.register_module("ocradmin.plugins.pil_nodes")


class UnsupportedCacheTypeError(StandardError):
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

        fname = [f for f in os.listdir(path) if f.endswith(("png", "json"))][0]
        filepath = os.path.join(path, fname)
        if fname.endswith("bin.png"):
            self.logger.debug("Reading binary cache: %s", filepath)
            return ocrolib.read_image_gray(filepath)
        elif fname.endswith(".png"):
            self.logger.debug("Reading colour cache: %s", filepath)
            packed = ocrolib.iulib.intarray()
            ocrolib.iulib.read_image_packed(packed, filepath)
            return ocrolib.narray2numpy(packed)
        elif fname.endswith(".json"):
            self.logger.debug("Reading JSON cache: %s", filepath)
            with open(filepath) as f:
                return json.load(f)
        else:
            raise UnsupportedCacheTypeError(filepath)

    def _write_node_data(self, path, data):
        if not os.path.exists(path):
            os.makedirs(path, 0777)
        if isinstance(data, numpy.ndarray):
            pngpath = os.path.join(path, "cache.png")
            if data.ndim == 2:
                #pngpath = os.path.join(path, "cache.png")
                ocrolib.write_image_gray(pngpath, data)
            else:
                packed = ocrolib.numpy2narray(data)
                ocrolib.iulib.write_image_packed(
                        pngpath, ocrolib.pseg2narray(data))
            self.logger.debug("Wrote cache: %s", pngpath)
            creator = deepzoom.ImageCreator(tile_size=512,
                    tile_overlap=2, tile_format="png",
                    image_quality=1, resize_filter="nearest")
            creator.create(pngpath, "%s.dzi" % os.path.splitext(pngpath)[0])
        else:
            jsonpath = os.path.join(path, "cache.json")
            with open(jsonpath, "w") as f:
                json.dump(data, f)
            self.logger.debug("Wrote cache: %s", jsonpath)

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
            pl = script.Script(nodelist, manager=manager, 
                    nodekwargs=dict(logger=logger, cacher=cacher))
            term = pl.get_node(evalnode)
            if term is None:
                term = pl.get_terminals()[0]
            result = term.eval()
        except ocropus_nodes.OcropusNodeError, err:
            logger.error("Ocropus Node Error (%s): %s", err.node, err.message)
            return dict(type="error", node=err.node.label, error=err.msg)

        if isinstance(result, numpy.ndarray):
            path = cacher.get_path(term.first_active())
            return dict(
                type="image",
                path=utils.media_path_to_url(os.path.join(path, "cache.png")),
                dzi=utils.media_path_to_url(os.path.join(path, "cache.dzi"))
            )
        elif isinstance(result, dict) and result.get("columns") is not None:
            path = cacher.get_path(term._inputs[0].first_active())
            dzi=utils.media_path_to_url(os.path.join(path, "cache.dzi"))
            return dict(type="pseg", data=result, dzi=dzi)
        else:
            return dict(type="text", data=result)


@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"
