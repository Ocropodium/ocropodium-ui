"""
Plugin manager.
"""

import os
import sys
import json
import node
import utils
import registry

class UnknownNodeError(StandardError):
    pass


class ModuleManager(object):
    """
    Class for managing OCR tool nodes.
    """
    def register_paths(self, paths, root=None):
        """
        Register a list of Python files, but hackily
        converting them to module paths.
        """
        pass

    def register_module(self, module):
        """
        Register a module containing nodes.
        """
        pass

    def get_new_node(self, type, label, params, **kwargs):
        kwargs.update(dict(label=label))
        nodecls = registry.nodes.get(type)
        if nodecls is None:
            raise UnknownNodeError(type)
        newnode = nodecls(**kwargs)
        for p, v in params:
            newnode.set_param(p, v)
        return newnode

    def get_modules(self, inpath=None):
        """
        List available node modules.
        """
        pass

    def get_nodes(self, *oftypes):
        """
        List available OCR plugins.  HACK: hard code stage
        attr at the moment.
        """
        oftypes = oftypes if len(oftypes) else None
        return registry.nodes.get_by_attr("stage", oftypes)

    def get_json(self, *oftypes):
        """
        Get Node json.
        """
        return json.dumps(self.get_nodes(*oftypes), cls=utils.NodeEncoder)
    
