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
from ocradmin.core import utils
from ocradmin.vendor import deepzoom
from ocradmin.core.tools.manager import PluginManager
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.plugins import parameters


def get_progress_function(task_id):
    """
    Closure for generating a function that refers to
    a task id in outer scope.
    """
    def progress_func(progress, lines=None):
        """
        Set progress for the given task.
        """
        task = OcrTask.objects.get(task_id=task_id)
        task.progress = progress
        if lines is not None:
            task.lines = lines
        task.save()
    return progress_func


def get_abort_function(task_id):
    """
    Closure for generating a function that takes
    no params but uses a task_id in outer scope.
    """
    def abort_func():
        """
        Check whether the task in question has been aborted.
        """
        # TODO: this should be possible via a simple 'self.is_aborted()'
        # Find out why it isn't.
        asyncres = AbortableAsyncResult(task_id)
        return asyncres.backend.get_status(task_id) == "ABORTED"
    return abort_func


def create_intermediate_paths(filepath, directory, params, logger):
    """
    Modify paramdict in place so if it's been told to write
    intermediate results we set the appropriate binary and
    segmentation paths.
    """
    # if we need to write intermediate files, determine the binpath
    # and the segpath needed
    if params.get("write_intermediate_results"):
        ensure_writable(directory, logger)
        basepath = os.path.join(directory, os.path.basename(filepath))
        params["bin_out"] = utils.get_media_output_path(basepath, "bin", ".png")
        params["seg_out"] = utils.get_media_output_path(basepath, "seg", ".png")


def ensure_writable(directory, logger):
    """
    Make sure we can write to the given directory,
    with appropriate permissions.
    """
    try:
        os.makedirs(directory, 0777)
    except OSError, (errno, _):
        if errno != 17:  # already exists, that's ok
            raise
    try:
        os.chmod(directory, 0777)
    except StandardError:
        logger.error("CHMOD FAILED: %s" % directory)
    return True


def create_binary_deepzoom(params, logger):
    """
    Create a DZI for binary files.
    """
    binpath = params.get("binout")
    if binpath and os.path.exists(binpath):
        dzipath = re.sub("\.png$", "_a.dzi", binpath)
        logger.info("Making binary DZI: %s" % dzipath)
        creator = deepzoom.ImageCreator(tile_size=512,
                tile_overlap=2, tile_format="png",
                image_quality=1, resize_filter="nearest")
        creator.create(binpath, dzipath)


def make_deepzoom_proxies(logger, inpath, outpath, params):
    """
    Make deepzoom versions of a source and output.
    """
    # now create deepzoom images of both source
    # and destination...
    creator = deepzoom.ImageCreator(tile_size=512,
            tile_overlap=2, tile_format="png",
            image_quality=1, resize_filter="nearest")

    # source DZI path gets passed in again so we don't have to remake it
    srcdzipath = utils.media_url_to_path(params.get("src"))
    if params.get("allowcache") is None:
        if srcdzipath is None or not os.path.exists(srcdzipath):
            srcdzipath = "%s_src.dzi" % os.path.splitext(outpath)[0]
            logger.info("Creating source DZI: %s -> %s" % (inpath, srcdzipath))
            creator.create(inpath, srcdzipath)

    # get an A or B output path that DOESN'T match the one
    # being passed in
    dstdzipath = utils.media_url_to_path(params.get("dst"))
    if dstdzipath is None or not os.path.exists(dstdzipath):
        dstdzipath = "%s_a.dzi" % os.path.splitext(outpath)[0]
    else:
        dstdzipath = utils.get_ab_output_path(dstdzipath)
    if not os.path.exists(dstdzipath) or not params.get("allowcache"):
        logger.info("Creating output DZI: %s -> %s" % (outpath, dstdzipath))
        creator.create(outpath, dstdzipath)

    logger.info(srcdzipath)
    logger.info(dstdzipath)
    try:
        os.chmod(outpath, 0777)
        os.chmod(dstdzipath, 0777)
        os.chmod(srcdzipath, 0777)
    except StandardError:
        logger.error("CHMOD FAILED: %s" % outpath)
    return srcdzipath, dstdzipath


class ConvertPageTask(AbortableTask):
    """
    Convert an image of text into some JSON.  This is done using
    the OcropusWrapper (and it's proxy, TessWrapper) in util.py.
    """
    name = "convert.page"
    max_retries = None

    def run(self, filepath, outdir, params, config, **kwargs):
        """
        Runs the convert action.
        """
        logger = self.get_logger()
        config = parameters.OcrParameters(config)
        # function for the converted to call periodically to check whether
        # to end execution early
        logger.info(params)
        logger.info(config)
        
        create_intermediate_paths(filepath, outdir, params, logger)
        converter = PluginManager.get_converter(
                config.name, logger=logger,
                abort_func=get_abort_function(self.request.id),
                config=config)
        # init progress to zero (for when retrying tasks)
        progress_func = get_progress_function(self.request.id)
        progress_func(0)
        out = converter.convert(filepath, progress_func=progress_func, **params)
        #create_binary_deepzoom(params, logger)
        return out


class ConvertLineTask(AbortableTask):
    """
    Convert a single line (from the given coords).  This is done using
    the OcropusWrapper (and it's proxy, TessWrapper) in util.py.
    """
    # FIXME FIXME FIXME
    name = "convert.line"
    max_retries = None

    def run(self, filepath, outdir, params, config, **kwargs):
        """
        Runs the convert action.
        """
        # function for the converted to call periodically to check whether
        # to end execution early
        logger = self.get_logger()
        config = parameters.OcrParameters(config)
        logger.info(params)
        create_intermediate_paths(filepath, outdir, params, logger)
        converter = PluginManager.get_converter(
                config.name,
                logger=logger, abort_func=None, config=config)
        params["prebinarized"] = True
        return converter.convert_lines(
                params.get("bin_out").encode(),
                params.get("coords"), **params)


class BinarizePageTask(AbortableTask):
    """
    Binarize an image of text into a temporary file.  Return some
    JSON containing the server-side path to that file.  The client
    then submits a request to have that binary full-size PNG converted
    into a scaled image for web viewing.
    """
    name = "binarize.page"

    def run(self, filepath, outdir, params, config, **kwargs):
        """
        Runs the binarize action.
        """
        logger = self.get_logger()
        logger.info(params)
        filepath = utils.make_png(filepath, outdir)
        config = parameters.OcrParameters(config)
        binname = os.path.basename(
                utils.get_media_output_path(filepath, "bin", ".png"))
        ensure_writable(outdir, logger)
        binpath = os.path.join(outdir, binname)
        # hack - this is to save time when doing the transcript editor
        # work - don't rebinarize of there's an existing file
        if os.path.exists(binpath) and params.get("allowcache"):
            logger.info("Not rebinarizing - file exists and allowcache is ON")
            pagewidth, pageheight = utils.get_image_dims(binpath)
        else:
            logger.info("Rebinarising - file exists: %s, cache: %s" % (
                os.path.exists(binpath),
                params.get("allowcache")))
            converter = PluginManager.get_converter(
                    config.name, logger=logger,
                    abort_func=get_abort_function(self.request.id),
                    config=config)
            page_bin = converter.standard_preprocess(filepath)
            pageheight, pagewidth = page_bin.shape
            converter.write_binary(binpath, page_bin)
        src, dst = make_deepzoom_proxies(logger, filepath, binpath, params)
        return dict(
            page=os.path.basename(filepath),
            box=[0, 0, pagewidth, pageheight],
            png=utils.media_path_to_url(filepath),
            out=utils.media_path_to_url(binpath),
            src=utils.media_path_to_url(src),
            dst=utils.media_path_to_url(dst)
        )


class SegmentPageTask(AbortableTask):
    """
    Segment an image of text into a temporary file.  Return some
    JSON containing the server-side path to that file.  The client
    then submits a request to have that binary full-size PNG converted
    into a scaled image for web viewing.
    """
    name = "segment.page"

    def run(self, filepath, outdir, params, config, **kwargs):
        """
        Runs the segment action.
        """
        logger = self.get_logger()
        logger.info(params)
        config = parameters.OcrParameters(config)
        filepath = utils.make_png(filepath, outdir)
        segname = os.path.basename(
                utils.get_media_output_path(filepath, "seg", ".png"))
        ensure_writable(outdir, logger)
        segpath = os.path.join(outdir, segname)
        converter = PluginManager.get_converter(
                config.name, logger=logger,
                abort_func=get_abort_function(self.request.id),
                config=config)
        page_bin = converter.standard_preprocess(filepath)
        page_seg = converter.get_page_seg(page_bin)
        pageheight, pagewidth = page_bin.shape
        boxes = converter.extract_boxes(page_seg)
        converter.write_packed(segpath, page_seg)
        src, dst = make_deepzoom_proxies(logger, filepath, segpath, params)
        return dict(
            page=os.path.basename(filepath),
            box=[0, 0, pagewidth, pageheight],
            png=utils.media_path_to_url(filepath),
            out=utils.media_path_to_url(segpath),
            src=utils.media_path_to_url(src),
            dst=utils.media_path_to_url(dst),
            **boxes
        )


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
        Clean the modia folder of any files that haven't
        been accessed for X minutes.
        """
        import glob
        logger = self.get_logger()
        tempdir = os.path.join(settings.MEDIA_ROOT,
                settings.TEMP_PATH)
        if not os.path.exists(tempdir):
            return
        for userdir in glob.glob("%s/*" % tempdir):
            if not os.path.isdir(userdir):
                continue
            logger.debug("Checking dir: %s" % userdir)
            fdirs = [d for d in sorted(os.listdir(userdir)) \
                    if re.match("\d{14}", d)]
            if not fdirs:
                continue
            # keep the latest, then delete everything
            # else not accessed in the last 10 mins
            logger.info("Retaining: %s" % os.path.join(userdir, fdirs.pop()))
            for fdir in fdirs:
                # convert the dir last accessed time to a datetime
                dtm = datetime(*time.localtime(
                        os.path.getmtime(os.path.join(userdir, fdir)))[0:6])
                delta = datetime.now() - dtm
                if delta.days < 1 and (delta.seconds / 60) <= 10:
                    logger.info("Retaining: %s" % os.path.join(userdir, fdir))
                    continue
                logger.info("Cleanup directory: %s" % os.path.join(userdir, fdir))
                try:
                    shutil.rmtree(os.path.join(userdir, fdir))
                except StandardError, err:
                    logger.critical(
                            "Error during cleanup: %s" % err.message)
