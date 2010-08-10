"""
Celery functions to be processed in a non-blocking distributed manner.
"""

import os
import re
import shutil
import time
from celery.contrib.abortable import AbortableTask
from celery.contrib.abortable import AbortableAsyncResult
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
    creator = deepzoom.ImageCreator(tile_size=512, tile_overlap=2, tile_format="png",
                            image_quality=1, resize_filter="nearest")

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
    if os.path.exists(dstdzipath) and params.get("allowcache"):
        pass
    else:
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
    max_retries = None

    def run(self, filepath, paramdict, **kwargs):
        """
        Runs the convert action.
        """
        # function for the converted to call periodically to check whether 
        # to end execution early
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)
        
        def abort_func():
            # TODO: this should be possible via a simple 'self.is_aborted()'
            # Find out why it isn't.
            asyncres = AbortableAsyncResult(kwargs["task_id"])            
            return asyncres.backend.get_status(kwargs["task_id"]) == "ABORTED" 

        converter = utils.get_converter(paramdict.get("engine", "tesseract"), 
                logger=logger, abort_func=abort_func, params=paramdict)
        
        # function for the converter to update progress
        from ocradmin.ocrtasks.models import OcrTask
        def progress_func(progress, lines=None):
            task = OcrTask.objects.get(task_id=kwargs["task_id"])
            task.progress = progress
            if lines is not None:
                task.lines = lines
            task.save()
        # init progress to zero (for when retrying tasks)
        progress_func(0)

        return converter.convert(filepath, progress_func=progress_func)

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
        # function for the converted to call periodically to check whether 
        # to end execution early
        def abort_func():
            # TODO: this should be possible via a simple 'self.is_aborted()'
            # Find out why it isn't.
            asyncres = AbortableAsyncResult(kwargs["task_id"])            
            return asyncres.is_aborted()

        logger = self.get_logger(**kwargs)
        logger.info(paramdict)

        filepath = utils.make_png(filepath)

        binpath = utils.get_media_output_path(filepath, "bin", ".png")
        # hack - this is to save time when doing the transcript editor
        # work - don't rebinarize of there's an existing file
        if os.path.exists(binpath) and paramdict.get("allowcache"):
            pagewidth, pageheight = utils.get_image_dims(binpath)
        else:
            converter = utils.get_converter(paramdict.get("engine", "ocropus"),                 
                    logger=logger, abort_func=abort_func, params=paramdict)
            grey, page_bin = converter.standard_preprocess(filepath)
            pagewidth = page_bin.dim(0)
            pageheight = page_bin.dim(1)
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
        # function for the converted to call periodically to check whether 
        # to end execution early
        def abort_func():
            # TODO: this should be possible via a simple 'self.is_aborted()'
            # Find out why it isn't.
            asyncres = AbortableAsyncResult(kwargs["task_id"])            
            return asyncres.is_aborted()

        logger = self.get_logger(**kwargs)
        logger.info(paramdict)

        filepath = utils.make_png(filepath)

        converter = utils.get_converter(paramdict.get("engine", "ocropus"),                 
                logger=logger, abort_func=abort_func, params=paramdict)
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


class CleanupTempTask(PeriodicTask):
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
        import glob
        logger = self.get_logger(**kwargs)
        tempdir = os.path.join(settings.MEDIA_ROOT, "temp")
        if not os.path.exists(tempdir):
            return

        for userdir in glob.glob("%s/*/*" % tempdir):
            logger.debug("Checking dir: %s" % userdir)
            fdirs = [d for d in sorted(os.listdir(userdir)) if re.match("\d{14}", d)]

            if not fdirs:
                continue

            # keep the latest, then delete everything
            # else not accessed in the last 10 mins
            logger.info("Retaining: %s" % fdirs.pop())
            for fdir in fdirs:
                # convert the dir last accessed time to a datetime
                dtm = datetime(*time.localtime(
                        os.path.getmtime(os.path.join(userdir, fdir)))[0:6])
                delta = datetime.now() - dtm
                if (delta.seconds / 60) <= 10:
                    continue
                logger.info("Cleanup directory: %s" % fdir)
                try:
                    shutil.rmtree(os.path.join(userdir, fdir))
                except StandardError, err:
                    logger.critical(
                            "Error during cleanup: %s" % err.message)


