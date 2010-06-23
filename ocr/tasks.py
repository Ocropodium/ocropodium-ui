"""
Celery functions to be processed in a non-blocking distributed manner.
"""

import os
import re
import shutil
import time
from celery.contrib.abortable import AbortableTask
from celery.task import PeriodicTask
from datetime import datetime, timedelta
from django.conf import settings
from ocradmin.ocr.utils import get_converter


class ConvertPageTask(AbortableTask):
    """
    Convert an image of text into some JSON.  This is done using
    the OcropusWrapper (and it's proxy, TessWrapper) in util.py.
    """
    name = "convert.page"

    def run(self, filepath, paramdict, **kwargs):
        """
        Runs the convert action.
        """
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)
        converter = get_converter(paramdict.get("engine", "tesseract"), 
                logger, paramdict)
        return converter.convert(filepath)


class CreateCleanupTempTask(PeriodicTask):
    """
    Periodically cleanup images in the settings.MEDIA_ROOT/temp
    directory.  Currently they're swept if they're over 10 minutes
    old.
    """
    name = "cleanup.temp"
    run_every = timedelta(seconds=600)
    relative = True
    ignore_result = True

    def run(self, **kwargs):
        """
        Clean the modia folder of any files that haven't been accessed for X minutes.
        """
        logger = self.get_logger(**kwargs)
        tempdir = os.path.join(settings.MEDIA_ROOT, "temp")
        if os.path.exists(tempdir):
            fdirs = [d for d in os.listdir(tempdir) if re.match("\d{14}", d)]
            for fdir in fdirs:
                # convert the dir last accessed time to a datetime
                dtm = datetime(*time.localtime(
                        os.path.getmtime(os.path.join(tempdir, fdir)))[0:6])
                delta = datetime.now() - dtm
                if (delta.seconds / 60) > 10:
                    logger.info("Cleanup directory: %s" % fdir)
                    try:
                        shutil.rmtree(os.path.join(tempdir, fdir))
                    except StandardError, err:
                        logger.critical(
                                "Error during cleanup: %s" % err.message)


