"""
Plugin manager.
"""

import os
import sys
import json
import node
import utils

class UnknownNodeError(StandardError):
    pass

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
                    

class ModuleManager(object):
    """
    Class for managing OCR tool nodes.
    """
    def __init__(self):
        # cache some things for efficiency
        self._modpaths = []
        self._mods = self.get_modules()
        self._nodes = self.get_nodes()

    def register_module(self, module):
        """
        Register a module containing nodes.
        """
        if not module in self._modpaths:
            self._modpaths.append(module)
        self._mods = self.get_modules()
        self._nodes = self.get_nodes()

    def get_new_node(self, type, label, params, **kwargs):
        modname, name = type.split("::")
        kwargs.update(dict(label=label))
        newnode = None
        for pm in self._mods:
            if pm.NAME == modname:
                newnode = pm.Manager.get_node(type, **kwargs)
        if newnode is None:
            raise UnknownNodeError(type)
        for p, v in params:
            newnode.set_param(p, v)
        return newnode

    def get_modules(self):
        """
        List available node modules.
        """
        mods = []
        for mname in self._modpaths:
            pm = __import__(
                    mname,
                    fromlist=["Manager"])
            if not hasattr(pm, "Manager"):
                continue
            mods.append(pm)
        return mods          

    def get_nodes(self, *oftypes):
        """
        List available OCR plugins.
        """
        nodes = []
        for pm in self.get_modules():
            nodes.extend(pm.Manager.get_nodes(*oftypes))
        return nodes

    def get_json(self, *oftypes):
        """
        Get Node json.
        """
        return json.dumps(self.get_nodes(*oftypes), cls=utils.NodeEncoder)
    
