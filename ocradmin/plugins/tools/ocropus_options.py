
import os
import copy

import generic_options
#reload(generic_options)

from ocradmin.ocrmodels.models import OcrModel
import ocrolib

class OcropusOptions(generic_options.GenericOptions):
    """
    Ocropus options.
    """
    name = "ocropus"

    @classmethod            
    def get_recognition_parameters(cls):
        """
        Ocropus recognition options.
        """
        params = super(OcropusOptions, cls).get_recognition_parameters()
        mods = OcrModel.objects.filter(app="ocropus")
        cmods = [dict(name=m.name, type="scalar", description=m.description) \
                    for m in mods if m.type == "char"]
        lmods = [dict(name=m.name, type="scalar", description=m.description) \
                    for m in mods if m.type == "lang"]
        return params + [
            dict(
                name="character_model",
                description="Character Model",
                type="scalar",
                help="Model for character recognition",
                value=cmods[0]["name"] if len(cmods) else None,
                multiple=False,
                choices=cmods,
            ), dict(
                name="language_model",
                description="Language Model",
                type="scalar",
                value=lmods[0]["name"] if len(lmods) else None,
                help="Model for language processing",
                multiple=False,
                choices=lmods,
            )
        ]
            
