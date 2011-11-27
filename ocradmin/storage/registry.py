"""
Registry for storage backends.

This class was adapted from the Celery Project's task registry.
"""

import inspect

class NotRegistered(KeyError):
    pass


class StorageRegistry(dict):
    NotRegistered = NotRegistered

    def register(self, store):
        """Register a store class in the store registry."""
        self[store.name] = inspect.isclass(store) and store or store.__class__

    def unregister(self, name):
        """Unregister store by name."""
        try:
            # Might be a store class
            name = name.name
        except AttributeError:
            pass
        self.pop(name)

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


stores = StorageRegistry()



