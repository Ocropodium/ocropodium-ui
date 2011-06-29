"""
OCR-specific nodetree cacher classes.
"""
import os

from nodetree import cache
from ocradmin.vendor import deepzoom
import hashlib
import bencode


class UnsupportedCacheTypeError(StandardError):
    pass


class BaseCacher(cache.BasicCacher):
    def __init__(self, path="", key="", **kwargs):
        super(BaseCacher, self).__init__(**kwargs)
        self._key = key
        self._path = path

    def set_cache(self, n, data):
        pass

    def get_cache(self, n):
        pass

    def has_cache(self, n):
        return False

    def get_path(self, n):
        hash = hashlib.md5(bencode.bencode(n.hash_value())).hexdigest()
        return os.path.join(self._path, self._key, n.label, hash)


class PersistantFileCacher(BaseCacher):
    """
    Store data in files for persistance.
    """
    def read_node_data(self, node, path):
        """
        Get the file data under path and return it.
        """
        readpath = os.path.join(path, node.get_file_name())
        self.logger.debug("Reading binary cache: %s", readpath)
        with open(readpath, "rb") as fh:
            return node.reader(fh)

    def write_node_data(self, node, path, data):
        if not os.path.exists(path):
            os.makedirs(path, 0777)
        filepath = os.path.join(path, node.get_file_name())
        self.logger.info("Writing cache: %s", filepath)
        with open(filepath, "w") as fh:
            node.writer(fh, data)

    def get_cache(self, n):
        path = self.get_path(n)
        if os.path.exists(path):
            return self.read_node_data(n, path)
        
    def set_cache(self, n, data):
        self.write_node_data(n, self.get_path(n), data)

    def has_cache(self, n):
        return os.path.exists(os.path.join(self.get_path(n), n.get_file_name()))


class DziFileCacher(PersistantFileCacher):
    """
    Write a DZI after having written a PNG.
    """
    def write_node_data(self, node, path, data):
        super(DziFileCacher, self).write_node_data(node, path, data)
        filepath = os.path.join(path, node.get_file_name())
        if filepath.endswith(".png"):
            creator = deepzoom.ImageCreator(tile_size=512,
                    tile_overlap=2, tile_format="png",
                    image_quality=1, resize_filter="nearest")
            creator.create(filepath, "%s.dzi" % os.path.splitext(filepath)[0])


class TestMockCacher(BaseCacher):
    """
    Mock cacher that doesn't do anything.
    """
    pass



