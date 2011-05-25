"""
Classes for customising node caching.
"""


class BasicCacher(object):
    """
    Basic in-memory caching.
    """
    def __init__(self, logger=None):
        self._cache = {}
        self.logger = logger

    def set_cache(self, node, data):
        """
        Store some data on the object.
        """
        self._cache[node.label] = data

    def get_cache(self, node):
        """
        Return cached data.
        """
        return self._cache.get(node.label)

    def has_cache(self, node):
        return self._cache.get(node.label) is not None

    def clear_cache(self, node):
        del self._cache[node.label]


class PersistantFileCacher(BasicCacher):
    """
    Store data in files for persistance.
    """
    def __init__(self, key=None, **kwargs):
        super(PersistantFileCacher, self).__init__(**kwargs)
        self._key = key

    def set_cache(self, node, data):
        self.logger.debug("FANCY CACHING")
        super(PersistantFileCacher, self).set_cache(node, data)



