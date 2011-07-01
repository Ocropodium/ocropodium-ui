"""
OCR-specific nodetree cacher classes.
"""
import os
import shutil

from nodetree import cache
from ocradmin.vendor import deepzoom
import hashlib
import bencode


class UnsupportedCacheTypeError(StandardError):
    pass


class BaseCacher(cache.BasicCacher):
    cachetype = "memory"
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

    def clear(self):
        pass


class PersistantFileCacher(BaseCacher):
    """
    Store data in files for persistance.
    """
    cachetype = "file"

    def read_node_data(self, node, path):
        """
        Get the file data under path and return it.
        """
        readpath = os.path.join(path, node.get_file_name())
        self.logger.debug("Reading %s cache: %s", self.cachetype, readpath)
        fh = self.get_read_handle(readpath)
        data = node.reader(fh)
        try:
            fh.close()
        except AttributeError:
            pass
        return data

    def write_node_data(self, node, path, data):
        if not os.path.exists(path):
            os.makedirs(path, 0777)
        filepath = os.path.join(path, node.get_file_name())
        self.logger.info("Writing %s cache: %s", self.cachetype, filepath)
        fh = self.get_write_handle(filepath)
        node.writer(fh, data)
        fh.close()

    def get_cache(self, n):
        path = self.get_path(n)
        if os.path.exists(path):
            return self.read_node_data(n, path)
    
    def get_read_handle(self, readpath):
        return open(readpath, "rb")

    def get_write_handle(self, filepath):
        return open(filepath, "wb")

    def set_cache(self, n, data):
        self.write_node_data(n, self.get_path(n), data)

    def has_cache(self, n):
        return os.path.exists(os.path.join(self.get_path(n), n.get_file_name()))

    def clear(self):
        shutil.rmtree(os.path.join(self._path, self._key))


class MongoDBCacher(PersistantFileCacher):
    """
    Write data to MongoDB instead of the FS.
    """
    cachetype = "MongoDB"
    def __init__(self, *args, **kwargs):
        super(MongoDBCacher, self).__init__(*args, **kwargs)
        from pymongo import Connection
        import gridfs
        self._db = getattr(Connection(), self._key)
        self._fs = gridfs.GridFS(self._db)

    def get_read_handle(self, readpath):
        return self._fs.get_last_version(filename=readpath)

    def get_write_handle(self, filepath):
        return self._fs.new_file(filename=filepath)

    def has_cache(self, n):
        return self._fs.exists(filename=os.path.join(self.get_path(n), n.get_file_name()))

    def clear(self):
        self._db.drop_collection("fs.files")
        self._db.drop_collection("fs.chunks")


class DziFileCacher(PersistantFileCacher):
    """
    Write a DZI after having written a PNG.
    """
    def write_node_data(self, node, path, data):
        super(DziFileCacher, self).write_node_data(node, path, data)
        filepath = os.path.join(path, node.get_file_name())
        fh = self.get_read_handle(filepath)
        if not os.path.exists(path):
            os.makedirs(path)
        if filepath.endswith(".png"):
            creator = deepzoom.ImageCreator(tile_size=512,
                    tile_overlap=2, tile_format="png",
                    image_quality=1, resize_filter="nearest")
            creator.create(fh, "%s.dzi" % os.path.splitext(filepath)[0])

    def clear(self):
        super(DziFileCacher, self).clear()
        if os.path.exists(os.path.join(self._path, self._key)):
            shutil.rmtree(os.path.join(self._path, self._key))


class TestMockCacher(BaseCacher):
    """
    Mock cacher that doesn't do anything.
    """
    pass



