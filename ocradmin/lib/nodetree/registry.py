"""
Registry class and global node registry.
"""

class NotRegistered(KeyError):
    pass


__all__ = ["NodeRegistry", "nodes"]


class NodeRegistry(dict):
    NotRegistered = NotRegistered

    def register(self, node):
        """Register a node in the node registry.

        The node will be automatically instantiated if not already an
        instance.

        """
        self[node.name] = inspect.isclass(node) and node() or node

    def unregister(self, name):
        """Unregister node by name."""
        try:
            # Might be a node class
            name = name.name
        except AttributeError:
            pass
        self.pop(name)

    def filter_types(self, type):
        """Return all nodes of a specific type."""
        return dict((name, node) for name, node in self.iteritems()
                                    if node.type == type)

    def __getitem__(self, key):
        try:
            return dict.__getitem__(self, key)
        except KeyError:
            raise self.NotRegistered(key)

    def pop(self, key, *args):
        try:
            return dict.pop(self, key, *args)
        except KeyError:
            raise self.NotRegistered(key)


nodes = NodeRegistry()


