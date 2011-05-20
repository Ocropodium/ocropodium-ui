
import generic_options
#reload(generic_options)

from ocradmin.ocrmodels.models import OcrModel

class TesseractOptions(generic_options.GenericOptions):
    """
    Tesseract options.
    """
    name = "tesseract"

    @classmethod            
    def get_recognition_parameters(cls):
        """
        Tesseract recognition options.
        """
        params = super(TesseractOptions, cls).get_recognition_parameters()
        mods = OcrModel.objects.filter(app="tesseract", type="lang")
        lmods = [dict(name=m.name, type="scalar", description=m.description)\
                for m in mods]
        return params + [
            dict(
                name="language_model",
                description="Language Model",
                type="scalar",
                value=lmods[0]["name"] if len(lmods) else None,
                help="Model for language processing",
                multiple=False,
                choices=lmods,
            )
        ]
            

