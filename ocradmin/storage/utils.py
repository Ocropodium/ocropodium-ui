"""
Utils for document storage.
"""

import json
from . import base

class DocumentEncoder(json.JSONEncoder):
    """
    Encoder for JSONifying documents.
    """
    def default(self, doc):
        """Flatten node for JSON encoding."""
        if issubclass(doc.__class__, base.BaseDocument):
            return dict(
                label=doc.label,
                pid=doc.pid
            )
        return super(DocumentEncoder, self).default(doc)



