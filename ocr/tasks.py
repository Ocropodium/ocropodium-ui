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


from ocradmin.ocr.utils import TessWrapper


class Params(object):
    def __init__(self, d):
        for a, b in d.iteritems():
            if isinstance(b, (list, tuple)):
               setattr(self, a, [obj(x) if isinstance(x, dict) else x for x in b])
            else:
               setattr(self, a, obj(b) if isinstance(b, dict) else b)


class check_aborted(object):

    def __init__(self, task):
        self.task = task

    def __call__(self, func):
        def argwrap(*args):
            if task.is_aborted():
                return {"status": task.status}
            func(*args)
        return argwrap



class ConvertPageTask(AbortableTask):

    name = "convert.page"

    def get_page_binary(self, filepath):
        page_gray = iulib.bytearray()
        iulib.read_image_gray(page_gray, filepath)        
        self.logger.info("Binarising image with %s" % self.params.clean)
        preproc = ocropus.make_IBinarize(self.params.clean.encode())
        page_bin = iulib.bytearray()
        preproc.binarize(page_bin, page_gray)
        return page_bin


    def get_page_seg(self, page_bin):
        self.logger.info("Segmenting page with %s" % self.params.pseg)
        segmenter = ocropus.make_ISegmentPage(self.params.pseg.encode())
        page_seg = iulib.intarray()
        segmenter.segment(page_seg, page_bin)
        return page_seg


    def get_ocropus_transcript(self, linerec, lmodel, line):
        fst = ocropus.make_OcroFST()
        linerec.recognizeLine(fst, line)
        result = iulib.ustrg()
        cost = ocropus.beam_search(result, fst, lmodel, 1000)
        return result.as_string()


    def run(self, filepath, paramdict, **kwargs):
        self.logger = self.get_logger(**kwargs)
        self.params = Params(paramdict or {})

        self.logger.info(paramdict)

        linerec = None
        lmodel = self.params.lmodel
        transcript_func = TessWrapper(self.logger)
        if self.params.engine == "ocropus":
            try:
                linerec = ocropus.load_linerec(self.params.cmodel.encode())
                lmodel = ocropus.make_OcroFST()
                lmodel.load(self.params.lmodel.encode())
                transcript_func = self.get_ocropus_transcript
            except Exception:
                raise Exception("Linerec loading exception: %s" % self.params.cmodel)

        page_bin = self.get_page_binary(filepath)
        page_seg = self.get_page_seg(page_bin)

        pagewidth = page_seg.dim(0)
        pageheight = page_seg.dim(1)

        self.logger.info("Extracting regions...")
        regions = ocropus.RegionExtractor()
        regions.setPageLines(page_seg)

        self.logger.info("Recognising lines...")

        pagedata = { "page" : os.path.basename(filepath) , "lines": [], "box": [0, 0, pagewidth, pageheight]}
        for i in range(1, regions.length()):
            
            # check if we've been aborted and quit...            
            #if self.is_aborted():
            #    return pagedata

            line = iulib.bytearray()
            regions.extract(line, page_bin, i, 1)        
            bbox = [regions.x0(i), pageheight - regions.y0(i),
                regions.x1(i) - regions.x0(i), regions.y1(i) - regions.y0(i)]            
            try:
                text = transcript_func(linerec, lmodel, line)
            except StandardError, e:
                text = ""
            pagedata["lines"].append({"line": i, "box": bbox, "text" : text })

        # make sure the tesseract wrapper is deleted - this triggers the
        # removal of it's temp files
        del transcript_func

        return pagedata






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
                        logger.critical("Oops: %s" % e.message)


