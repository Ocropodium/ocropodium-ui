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
from django.core.files.base import File
from django.conf import settings

from ocradmin.ocr import utils as ocrutils
from ocradmin.training import utils

from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.projects.models import OcrProject, ReferencePage



class LineTrainTask(AbortableTask):
    """
    Given a collection of training pages (result objects)
    and their associated images, run OCRopus line training
    using a given model.
    """
    name = "cmodel.training"
    max_retries = None
    
    def run(self, dataset_ids, cmodel_id, outdir, **kwargs):
        """
        Run line train task.
        """
        datasets = ReferencePage.objects.filter(pk__in=dataset_ids)
        cmodel = OcrModel.objects.get(pk=cmodel_id)
        #cmodel = OcrModel.objects.get(pk=cmodel_id)
        paramdict = dict(
            cmodel=cmodel.file.path.encode(),
            outmodel=os.path.join(outdir, os.path.basename(cmodel.file.path.encode())),
        )
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)

        # check output dir exists
        if not os.path.exists(outdir):
            os.makedirs(outdir)
            os.chmod(outdir, 0777)

        def abort_func():
            # TODO: this should be possible via a simple 'self.is_aborted()'
            # Find out why it isn't.
            asyncres = AbortableAsyncResult(kwargs["task_id"])            
            return asyncres.is_aborted()


        trainer = ocrutils.get_trainer(logger=logger, abort_func=abort_func,
                params=paramdict)

        # function for the converter to update progress
        from ocradmin.ocrtasks.models import OcrTask
        def progress_func(progress, lines=None):
            task = OcrTask.objects.get(task_id=kwargs["task_id"])
            task.progress = progress
            if lines is not None:
                task.lines = lines
            task.save()
        # init progress to zero (for when retrying tasks)
        #progress_func(0)
        
        for pagedata in datasets:
            #pagedata = ReferencePage.objects.get(pk=pk)
            trainer.load_training_binary(pagedata.binary_image_path.encode())
            # we've got a Training page.  Go through it, and 
            # train on each line
            for line in pagedata.data["lines"]:
                trainer.train_line(line["box"], line["text"])
        
        trainer.save_new_model()
        logger.info("SAVING MODEL: test.cmodel")

        fh = open(paramdict["outmodel"], "rb")
        derivednum = cmodel.ocrmodel_set.count() + 1
        newmodel = OcrModel(
            user=cmodel.user,
            name="%s Retrain %d" % (cmodel.name, derivednum),
            derived_from=cmodel,
            description="<DERIVED FROM %s>\n\n%s" % (cmodel.name, cmodel.description),
            public=cmodel.public,
            type=cmodel.type,
            app=cmodel.app,
            file=File(fh),             
        )
        newmodel.save()
        fh.close()
        return { "new_model_pk": newmodel.pk }




class ComparisonTask(AbortableTask):
    """
    Run a comparison of a given model on a 
    binarized image and compare output to
    a ground-truth.
    """
    name = "compare.groundtruth"
    max_retries = None

    def run(self, gt_id, outdir, paramdict, **kwargs):
        """
        Runs the model comparison action.
        """
        groundtruth = ReferencePage.objects.get(pk=gt_id)

        # function for the converted to call periodically to check whether 
        # to end execution early
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)
        task = OcrTask.objects.get(task_id=kwargs["task_id"])

        def abort_func():
            # TODO: this should be possible via a simple 'self.is_aborted()'
            # Find out why it isn't.
            asyncres = AbortableAsyncResult(kwargs["task_id"])            
            return asyncres.backend.get_status(kwargs["task_id"]) == "ABORTED" 

        # ground truth is already a binary, so tell the converter not
        # to redo it...
        paramdict["prebinarized"] = True
        converter = ocrutils.get_converter(paramdict.get("engine", "tesseract"), 
                logger=logger, abort_func=abort_func, params=paramdict)
        
        # function for the converter to update progress
        def progress_func(progress, lines=None):
            task = OcrTask.objects.get(task_id=kwargs["task_id"])
            task.progress = progress
            if lines is not None:
                task.lines = lines
            task.save()
        # init progress to zero (for when retrying tasks)
        progress_func(0)

        outdata = converter.convert(groundtruth.binary_image_path.encode(),
                progress_func=progress_func)        

        accuracy, details = utils.isri_accuracy(
                logger, 
                ocrutils.output_to_plain_text(groundtruth.data),
                ocrutils.output_to_plain_text(outdata))
        # there's be no details if something went wrong
        assert(details)
        task.parameter_score.score = accuracy
        task.parameter_score.score_internals = details.decode("unicode_escape")
        task.parameter_score.save()
        return outdata

        

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
        logger = self.get_logger(**kwargs)
        from PIL import Image
        base, ext = os.path.splitext(path)
        im = Image.open(path)
        im.thumbnail(size, Image.ANTIALIAS)
        thumbpath = "%s.thumb.jpg" % base
        im.save(thumbpath, "JPEG")
        logger.info("Generated thumb: %s" % thumbpath)

