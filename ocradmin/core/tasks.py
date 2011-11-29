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
from ocradmin.core import utils
from ocradmin.vendor import deepzoom
from ocradmin.projects.models import Project


class UnhandledCreateDzi(AbortableTask):
    name = "_create.dzi"

    def run(self, filepath, path, **kwargs):
        """
        Create a DZI of the given file, as <path>/dzi/<basename>.
        """
        logger = self.get_logger()
        # find the deepzoom path
        if not os.path.exists(os.path.dirname(path)):
            os.makedirs(os.path.dirname(path))
        if not os.path.exists(path):
            creator = deepzoom.ImageCreator(tile_size=512,
                    tile_overlap=2, tile_format="png",
                    image_quality=1, resize_filter="nearest")
            logger.debug("Creating DZI path: %s", path)
            creator.create(filepath, path)
        return dict(out=utils.media_path_to_url(filepath),
                dst=utils.media_path_to_url(path))


class UnhandledCreateDocDzi(AbortableTask):
    name = "_create.docdzi"

    def run(self, project_pk, pid, **kwargs):
        """
        Create a DZI of the given document, as <path>/dzi/<basename>.
        """
        logger = self.get_logger()
        project = Project.objects.get(pk=project_pk)
        storage = project.get_storage()
        path = "%s/files/%s/%s/%s.dzi" % (
                settings.MEDIA_ROOT,
                storage.namespace,
                pid, "BINARY")

        if not os.path.exists(os.path.dirname(path)):
            os.makedirs(os.path.dirname(path))
        if not os.path.exists(path):
            creator = deepzoom.ImageCreator(tile_size=512,
                    tile_overlap=2, tile_format="png",
                    image_quality=1, resize_filter="nearest")
            logger.debug("Creating DZI path: %s", path)
            creator.create(storage.get(pid).binary_content, path)
        return dict(pid=pid, dst=utils.media_path_to_url(path))




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
