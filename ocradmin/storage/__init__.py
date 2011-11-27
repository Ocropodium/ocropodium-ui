"""
Storage module.  Abstracts various document-storage backends.
"""

from __future__ import absolute_import


from . import registry, fedora, file_system, mongodb


def get_backend(name):
    return registry.stores[name]


