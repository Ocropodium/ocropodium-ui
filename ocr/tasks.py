"""
Celery functions to be processed in a non-blocking distributed manner.
"""

import os
import re
import shutil
import time
import uuid
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

class BinarizePageTask(AbortableTask):
    """
    Binarize an image of text into a temporary file.  Return some
    JSON containing the server-side path to that file.  The client
    then submits a request to have that binary full-size PNG converted
    into a scaled image for web viewing.
    """
    name = "binarize.page"

    def run(self, filepath, paramdict, **kwargs):
        """
        Runs the binarize action.
        """
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)
        converter = get_converter(paramdict.get("engine", "ocropus"),                 
                logger, paramdict)
        page_bin = converter.get_page_binary(filepath)
        pagewidth = page_bin.dim(0)
        pageheight = page_bin.dim(1)
        import iulib
        base, ext = os.path.splitext(os.path.basename(filepath))
        binpath =  "%s/bintemp/%s_%s%s" % (settings.MEDIA_ROOT, 
                base, uuid.uuid1(), ext)
        pagedata = { 
            "page" : os.path.basename(filepath) ,
            "src" : None,
            "dst" : None,
            "box": [0, 0, pagewidth, pageheight]
        }
        srcmediapath = filepath.replace(settings.MEDIA_ROOT, settings.MEDIA_URL, 1) 
        binmediapath = binpath.replace(settings.MEDIA_ROOT, settings.MEDIA_URL, 1)
        iulib.write_image_binary(binpath, page_bin)
        pagedata["src"] = os.path.abspath(srcmediapath)
        pagedata["dst"] = os.path.abspath(binmediapath)
        return pagedata


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


