"""
Utils for dealing with Nodes/Plugins.
"""

import json
import node
import types



class NodeEncoder(json.JSONEncoder):
    """
    Encoder for JSONifying nodes.
    """
    def default(self, n):
        """
        Flatten node.
        """
        # FIXME: issubclass doesn't work because the
        # qualified module names don't match.  Work
        # out why and remove this hack.
        nbases = []
        if type(n) == types.TypeType:
            nbases = [b for b in n.__mro__ if \
                    b.__name__.find("Node") != -1]
        if len(nbases) > 0:
            return dict(
                name=n.name,
                description=n.description,
                arity=n.arity,
                stage=n.stage,
                parameters=n.parameters(),
            )
        return super(NodeEncoder, self).default(n)            




