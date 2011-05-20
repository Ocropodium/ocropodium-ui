"""
Plugin manager.
"""

import os
import sys


class PluginManager(object):
    """
    Class for managing OCR tool plugins.
    """
    def __init__(self):
        pass


    @classmethod
    def get_plugins(cls):
        """
        List available OCR plugins.
        """
        engines = []
        plugdir = os.path.join(os.path.dirname(__file__), "tools")
        for fname in os.listdir(plugdir):
            if not fname.endswith("wrapper.py"):
                continue
            modname = os.path.splitext(os.path.basename(fname))[0]
            pm = __import__(
                    modname,
                    fromlist=["main_class"])
            if not hasattr(pm, "main_class"):
                continue
            mod = pm.main_class()
            engines.append(dict(
                name=mod.name,
                type="list",
                description=mod.description,
                parameters=True,
            ))
        return engines


    @classmethod
    def get(cls, name, *args, **kwargs):
        """
        Get a plugin directly.
        """
        return cls._main_class(name)


    @classmethod
    def get_info(cls, name, *args, **kwargs):
        """
        Get info about a plugin.
        """
        mc = cls._main_class(name)
        if mc is not None:
            return mc.get_info(*args, **kwargs)


    @classmethod
    def get_parameters(cls, name, *args, **kwargs):
        """
        Get general options for an engine.
        """
        print "Getting options: " + name
        mc = cls._main_class(name)
        if mc is not None:
            return mc.get_parameters(*args, **kwargs)


    @classmethod
    def get_trainer(cls, name, *args, **kwargs):
        """
        Fetch a given trainer class.  Currently this is the
        same as the converter.
        """
        return cls.get_converter(name, *args, **kwargs)


    @classmethod
    def get_converter(cls, name, *args, **kwargs):
        """
        Get a converter with a given name.
        """
        mc = cls._main_class(name)
        if mc is not None:
            return mc(*args, **kwargs)


    @classmethod
    def get_components(cls, name, *args, **kwargs):
        """
        Get available components of the given type for given plugin.
        """
        mc = cls._main_class(name)
        if mc is not None:
            return mc.get_components(*args, **kwargs)


    @classmethod
    def _main_class(cls, name):
        """
        Get the plugin class with a given name.
        """
        plugdir = os.path.join(os.path.dirname(__file__), "tools")
        for fname in os.listdir(plugdir):
            modname = "%s_wrapper.py" % name
            if fname == modname:
                # FIXME: Hard-coded module import path needs to change
                # TODO: Generally find a better way of doing this...
                pm = __import__("%s_wrapper" % name, fromlist=["main_class"])
                return pm.main_class()

