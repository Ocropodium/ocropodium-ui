"""
Run plugin tasks on the Celery queue
"""

import os
import script

from celery.contrib.abortable import AbortableTask
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.core import utils

import numpy

def save_nimage(fname, img):
    import ocrolib
    from ocradmin.vendor import deepzoom
    ocrolib.write_image_gray(fname.encode(), img)
    creator = deepzoom.ImageCreator(tile_size=512,
            tile_overlap=2, tile_format="png",
            image_quality=1, resize_filter="nearest")
    dzipath = "%s.dzi" % os.path.splitext(fname)[0]
    creator.create(fname, dzipath)
    return dzipath


class UnhandledRunScriptTask(AbortableTask):
    """
    Convert an image of text into some JSON.  This is done using
    the OcropusWrapper (and it's proxy, TessWrapper) in util.py.
    """
    name = "_run.script"
    max_retries = None

    def run(self, evalnode, nodelist, writepath, **kwargs):
        """
        Runs the convert action.
        """
        logger = self.get_logger()

        try:
            pl = script.Script(nodelist, logger=logger)
            term = pl.get_node(evalnode)
            result = term.eval()
        except StandardError, err:
            raise
        if isinstance(result, numpy.ndarray):            
            if not os.path.exists(writepath):
                os.makedirs(writepath, 0777)
            path = os.path.join(writepath, "output.png")
            dzi = save_nimage(path, result)
            result = dict(
                path=utils.media_path_to_url(path), 
                dzi=utils.media_path_to_url(dzi)
            )
        return result

@register_handlers
class RunScriptTask(UnhandledRunScriptTask):
    name = "run.script"
