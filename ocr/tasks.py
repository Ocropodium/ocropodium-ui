import os
import re
import sys
import commands
import subprocess as sp
import tempfile
import time
from datetime import datetime, timedelta
import shutil

from celery.task import Task, PeriodicTask
from celery.contrib.abortable import AbortableTask
from celery.decorators import periodic_task
from django.contrib.auth.models import User
from django.conf import settings

import ocropus
import iulib

from ocradmin.ocr.utils import get_converter


class Params(object):
    def __init__(self, d):
        for a, b in d.iteritems():
            if isinstance(b, (list, tuple)):
               setattr(self, a, [obj(x) if isinstance(x, dict) else x for x in b])
            else:
               setattr(self, a, obj(b) if isinstance(b, dict) else b)


class ConvertPageTask(AbortableTask):

    name = "convert.page"

    def run(self, filepath, paramdict, **kwargs):
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)
        converter = get_converter(paramdict.get("engine", "tesseract"), 
                logger, paramdict)
        return converter.convert(filepath)




class CreateCleanupTempTask(PeriodicTask):
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
                dt = datetime(*time.localtime(os.path.getmtime(os.path.join(tempdir, fdir)))[0:6])
                delta = datetime.now() - dt
                if (delta.seconds / 60) > 10:
                    logger.info("Cleanup directory: %s" % fdir)
                    try:
                        shutil.rmtree(os.path.join(tempdir, fdir))
                    except Exception, e:
                        logger.critical("Error during cleanup: %s" % e.message)


