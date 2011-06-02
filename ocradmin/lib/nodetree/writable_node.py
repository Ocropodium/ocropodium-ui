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
    def reader(cls, dirpath):
        """Read a cache from a given dir."""
        fpath = os.path.join(dirpath, cls.get_file_name())
        if os.path.exists(fpath):
            with open(fpath, "r") as fh:
                return pickle.load(fh)

    @classmethod
    def writer(cls, dirpath, data):
        """Write a cache from a given dir."""
        fpath = os.path.join(dirpath, cls.get_file_name())
        with open(fpath, "w") as fh:
            pickle.dump(data, fh)
        return fpath            
