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
    def get_provider(cls, provides):
        """
        Get a list of available OCR engines.        
        """
        engines = []
        plugdir = os.path.join(os.path.dirname(__file__), "plugins")
        for fname in os.listdir(plugdir):
            if fname.endswith("wrapper.py"):
                modname = os.path.splitext(os.path.basename(fname))[0]
                pm = __import__(
                        "ocradmin.ocr.tools.plugins.%s" % modname,
                        fromlist=["main_class"])
                if not hasattr(pm, "main_class"):
                    continue
                mod = pm.main_class()
                if isinstance(provides, str) and provides in mod.capabilities:
                    engines.append(mod.name)
                elif isinstance(provides, tuple):
                    for cap in provides:
                        if cap in mod.capabilities:
                            engines.append(mod.name)
                            break
        return engines                    

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
        plugdir = os.path.join(os.path.dirname(__file__), "plugins")
        for fname in os.listdir(plugdir):
            modname = "%s_wrapper.py" % name
            if fname == modname:
                # FIXME: Hard-coded module import path needs to change
                # TODO: Generally find a better way of doing this...
                pm = __import__("ocradmin.ocr.tools.plugins.%s_wrapper" % name, fromlist=["main_class"])
                return pm.main_class()(*args, **kwargs)




