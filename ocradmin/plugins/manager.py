"""
Plugin manager.
"""

import os
import sys
import json
import node
import utils

class StandardManager(object):
    """
    Manager that simple returns a list
    of classes in the current file that
    end in 'Node'.
    """
    # FIXME: This will break in Python 3 (but so
    # will everything else I suppose...)
    @classmethod
    def get_nodes(cls, *oftypes, **kwargs):
        globaldict = kwargs.get("globals")
        if globaldict is None:
            globaldict = globals()
        test = kwargs.get("testfunc")
        nodes = []
        for name, item in globaldict.iteritems():
            if not isinstance(item, type) or \
                    not name.endswith("Node"):
                continue
            if test is not None:
                if not test(item):
                    continue
            if len(oftypes) > 0:
                if item.stage not in oftypes:
                    continue
            nodes.append(item)
        return nodes
                    

class PluginManager(object):
    """
    Old version - to be removed.
    """
    @classmethod
    def get_converter(cls, name):
        pass

    def get_trainer(cls, name):
        pass


class ModuleManager(object):
    """
    Class for managing OCR tool nodes.
    """
    def __init__(self):
        # cache some things for efficiency
        self._mods = self.get_modules()
        self._nodes = self.get_nodes()

    def get_new_node(self, type, label, params):
        modname, name = type.split("::")
        kwargs = dict(label=label)
        newnode = None
        for pm in self._mods:
            if pm.__name__.endswith("%s_nodes" % modname.lower()):
                newnode = pm.Manager.get_node(name, **kwargs)
        if newnode is None:
            raise node.UnknownNodeError(type)
        for p, v in params:
            newnode.set_param(p, v)
        return newnode

    @classmethod
    def get_modules(cls):
        """
        List available node modules.
        """
        mods = []
        plugdir = os.path.dirname(__file__)
        for fname in os.listdir(plugdir):
            if not fname.endswith("nodes.py"):
                continue
            modname = os.path.splitext(os.path.basename(fname))[0]
            pm = __import__(
                    "plugins.%s" % modname,
                    fromlist=["Manager"])
            if not hasattr(pm, "Manager"):
                continue
            mods.append(pm)
        return mods          

    @classmethod
    def get_nodes(cls, *oftypes):
        """
        List available OCR plugins.
        """
        nodes = []
        for pm in cls.get_modules():
            nodes.extend(pm.Manager.get_nodes(*oftypes))
        return nodes

    @classmethod
    def get_json(cls, *oftypes):
        """
        Get Node json.
        """
        return json.dumps(cls.get_nodes(*oftypes), cls=utils.NodeEncoder)
    
