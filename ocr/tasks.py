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
from ocradmin.ocr import utils
import iulib


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
        converter = utils.get_converter(paramdict.get("engine", "tesseract"), 
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
        converter = utils.get_converter(paramdict.get("engine", "ocropus"),                 
                logger, paramdict)
        grey, page_bin = converter.standard_preprocess(filepath)
        pagewidth = page_bin.dim(0)
        pageheight = page_bin.dim(1)
        binpath = paramdict.get("dst", "").encode()
        if not binpath:
            base, ext = os.path.splitext(os.path.basename(filepath))
            binpath =  "%s/bintemp/%s_%s%s" % (settings.MEDIA_ROOT, 
                    base, uuid.uuid1(), ".png")
        pagedata = { 
            "page" : os.path.basename(filepath) ,
            "src" : None,
            "dst" : None,
            "box": [0, 0, pagewidth, pageheight]
        }

        iulib.write_image_binary(binpath, page_bin)
        srcmediaurl = utils.media_path_to_url(filepath)
        binmediaurl = utils.media_path_to_url(binpath)

        # get a smaller representation of the files
        if paramdict.get("twidth"):
            newsize = utils.new_size_from_width(
                    (pagewidth, pageheight), int(paramdict.get("twidth")))
            srctmppath = "%s_scaled%s" % os.path.splitext(filepath)
            dsttmppath = "%s_scaled%s" % os.path.splitext(binpath) 
            utils.scale_image(filepath, srctmppath, newsize)
            utils.scale_image(binpath, dsttmppath, newsize)
            srcmediaurl = utils.media_path_to_url(srctmppath)
            binmediaurl = utils.media_path_to_url(dsttmppath)

        pagedata["src"] = srcmediaurl
        pagedata["dst"] = binmediaurl
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


