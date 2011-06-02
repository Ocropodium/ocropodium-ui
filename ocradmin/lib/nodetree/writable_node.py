"""
WritableNode 
"""

import os
import pickle

import node

class WritableNodeMixin(object):
    """
    Mixin for a class of node which knows how to read and write
    itself to the filesystem via reader and writer
    functions.
    """
    extension = ".pickle"

    @classmethod
    def get_file_name(cls):
        return "%s%s" % (cls.name, cls.extension)

    @classmethod
    def reader(cls, path):
        """Read a cache from a given dir."""
        if os.path.exists(path):
            with open(path, "r") as fh:
                return pickle.load(fh)

    @classmethod
    def writer(cls, path, data):
        """Write a cache from a given dir."""
        with open(path, "w") as fh:
            pickle.dump(data, fh)
        return path            
