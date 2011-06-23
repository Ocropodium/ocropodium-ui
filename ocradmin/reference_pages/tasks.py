"""
Celery functions to be processed in a non-blocking distributed manner.
"""

import os
from celery.contrib.abortable import AbortableTask


class MakeThumbnailTask(AbortableTask):
    """
    Create a thumbnail of a given image.
    """
    name = "image.thumbnail"
    max_retries = None
    ignore_result = True

    def run(self, path, size, **kwargs):
        """
        Runs the model comparison action.
        """
        logger = self.get_logger()
        from PIL import Image
        base = os.path.splitext(path)[0]
        img = Image.open(path)
        img.thumbnail(size, Image.ANTIALIAS)
        thumbpath = "%s.thumb.jpg" % base
        img.save(thumbpath, "JPEG")
        logger.debug("Generated thumb: %s" % thumbpath)


