"""
Object representation of a Node script.
"""

import manager as stdmanager


class Script(object):
    """
    Object describing the OCR pipeline.
    """
    def __init__(self, script, manager=None, nodekwargs=None):
        """
        Initialiser.
        """
        self._nodekwargs = nodekwargs if nodekwargs is not None \
                else {}
        self._script = script
        self._error = None
        self._tree = {}
        self._manager = manager if manager is not None \
                else stdmanager.ModuleManager()
        self._build_tree()

    def _build_tree(self):
        """
        Wire up the nodes in tree order.
        """
        for name, n in self._script.iteritems():
            if name.startswith("__"):
                continue
            self._tree[name] = self._manager.get_new_node(
                    n["type"], name, n["params"], **self._nodekwargs)
            self._tree[name].ignored = n.get("ignored", False)
        for name, n in self._script.iteritems():
            if name.startswith("__"):
                continue
            for i in range(len(n["inputs"])):
                self._tree[name].set_input(i, self._tree.get(n["inputs"][i]))

    def get_node(self, name):
        """
        Find a node in the tree.
        """
        return self._tree.get(name)

    def get_nodes_by_attr(self, name, value):
        """
        Find a node by attibute value.
        """
        nodes = []
        for node in self._tree.itervalues():
            if hasattr(node, name) and getattr(node, name) == value:
                nodes.append(node)
        return nodes

    def get_terminals(self):
        """
        Get nodes that end a branch.
        """
        return [n for n in self._tree.itervalues() \
                if not n.has_parents()]


