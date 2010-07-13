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
from ocradmin.ocr import utils
from ocradmin.vendor import deepzoom
import iulib


def make_deepzoom_proxies(logger, inpath, outpath, type, params):
    """
    Make deepzoom versions of a source and output.
    """
    # now create deepzoom images of both source
    # and destination...
    creator = deepzoom.ImageCreator(tile_size=256, tile_overlap=2, tile_format="png",
                            image_quality=1, resize_filter="bicubic")

    # source DZI path gets passed in again so we don't have to remake it
    srcdzipath = utils.media_url_to_path(params.get("src"))
    if srcdzipath is None or not os.path.exists(srcdzipath):
        srcdzipath = "%s.dzi" % os.path.splitext(inpath)[0]
        creator.create(inpath, srcdzipath)


    # get an A or B output path that DOESN'T match the one
    # being passed in
    dstdzipath = utils.media_url_to_path(params.get("dst"))
    if dstdzipath is None or not os.path.exists(dstdzipath):            
        dstdzipath = "%s_a.dzi" % os.path.splitext(outpath)[0]
    else:
        dstdzipath = utils.get_ab_output_path(dstdzipath)
    creator.create(outpath, dstdzipath)

    logger.info(srcdzipath)
    logger.info(dstdzipath)
    try:
        os.chmod(outpath, 0777)
        os.chmod(dstdzipath, 0777)
        os.chmod(srcdzipath, 0777)
    except Exception:
        pass

    return srcdzipath, dstdzipath


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

        filepath = utils.make_png(filepath)

        converter = utils.get_converter(paramdict.get("engine", "ocropus"),                 
                logger, paramdict)
        grey, page_bin = converter.standard_preprocess(filepath)
        pagewidth = page_bin.dim(0)
        pageheight = page_bin.dim(1)
        binpath = utils.get_media_output_path(filepath, "bin", ".png")
        iulib.write_image_binary(binpath, page_bin)
        
        pagedata = { 
            "page" : os.path.basename(filepath) ,
            "src" : None,
            "dst" : None,
            "box": [0, 0, pagewidth, pageheight]
        }
        
        src, dst = make_deepzoom_proxies(logger, filepath, binpath, "bin", paramdict)
        pagedata["png"] = utils.media_path_to_url(filepath)
        pagedata["out"] = utils.media_path_to_url(binpath)
        pagedata["src"] = utils.media_path_to_url(src)
        pagedata["dst"] = utils.media_path_to_url(dst)
    
        return pagedata



class SegmentPageTask(AbortableTask):
    """
    Segment an image of text into a temporary file.  Return some
    JSON containing the server-side path to that file.  The client
    then submits a request to have that binary full-size PNG converted
    into a scaled image for web viewing.
    """
    name = "segment.page"

    def run(self, filepath, paramdict, **kwargs):
        """
        Runs the segment action.
        """
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)

        filepath = utils.make_png(filepath)

        converter = utils.get_converter(paramdict.get("engine", "ocropus"),                 
                logger, paramdict)
        grey, page_bin = converter.standard_preprocess(filepath)
        page_seg = converter.get_page_seg(page_bin)

        pagewidth = page_seg.dim(0)
        pageheight = page_seg.dim(1)
        segpath = utils.get_media_output_path(filepath, "seg", ".png")
        iulib.write_image_packed(segpath, page_seg)

        pagedata = { 
            "page" : os.path.basename(filepath) ,
            "png" : None,
            "src" : None,
            "dst" : None,
            "box": [0, 0, pagewidth, pageheight]
        }

        src, dst = make_deepzoom_proxies(logger, filepath, segpath, "seg", paramdict)
        pagedata["png"] = utils.media_path_to_url(filepath)
        pagedata["src"] = utils.media_path_to_url(src)
        pagedata["dst"] = utils.media_path_to_url(dst)
    
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


