"""
Celery functions to be processed in a non-blocking distributed manner.
"""

import os
from celery.contrib.abortable import AbortableTask
from celery.contrib.abortable import AbortableAsyncResult
from django.core.files.base import File

from ocradmin.core import utils as ocrutils
from ocradmin.training import utils
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrtasks.models import OcrPageTask
from ocradmin.ocrtasks.decorators import register_handlers
from ocradmin.ocrtasks.utils import get_progress_callback, get_abort_callback
from ocradmin.reference_pages.models import ReferencePage
from ocradmin.core.tools.manager import PluginManager

from ocradmin.plugins import parameters


@register_handlers
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
        outmodel=os.path.join(outdir, 
            os.path.basename(cmodel.file.path.encode())),
        paramdict = dict(
            cmodel=cmodel.file.path.encode(),
        )
        logger = self.get_logger(**kwargs)
        logger.info(paramdict)

        # check output dir exists
        if not os.path.exists(outdir):
            os.makedirs(outdir)
            os.chmod(outdir, 0777)

        trainer = PluginManager.get_trainer("ocropus", logger=logger, 
                abort_func=get_abort_callback(self.request.id),
                params=paramdict)
        for pagedata in datasets:
            trainer.load_training_binary(pagedata.binary_image.path.encode())
            # we've got a Training page.  Go through it, and 
            # train on each line
            for line in pagedata.data["lines"]:
                trainer.train_line(line["box"], line["text"])
        
        trainer.save_new_model(outmodel)
        logger.info("SAVING MODEL: %s" % outmodel)

        fhdl = open(outmodel, "rb")
        derivednum = cmodel.ocrmodel_set.count() + 1
        newmodel = OcrModel(
            user=cmodel.user,
            name="%s Retrain %d" % (cmodel.name, derivednum),
            derived_from=cmodel,
            description="<DERIVED FROM %s>\n\n%s" % \
                    (cmodel.name, cmodel.description),
            public=cmodel.public,
            type=cmodel.type,
            app=cmodel.app,
            file=File(fhdl),             
        )
        newmodel.save()
        fhdl.close()
        return { "new_model_pk": newmodel.pk }


@register_handlers
class ComparisonTask(AbortableTask):
    """
    Run a comparison of a given model on a 
    binarized image and compare output to
    a ground-truth.
    """
    name = "compare.groundtruth"
    max_retries = None

    def run(self, gt_id, outdir, params, config, **kwargs):
        """
        Runs the model comparison action.
        """
        groundtruth = ReferencePage.objects.get(pk=gt_id)
        config = parameters.OcrParameters(config)

        # function for the converted to call periodically to check whether 
        # to end execution early
        logger = self.get_logger(**kwargs)
        task = OcrPageTask.objects.get(task_id=self.request.id)

        # ground truth is already a binary, so tell the converter not
        # to redo it...
        converter = PluginManager.get_converter(
                config.name, 
                logger=logger, abort_func=get_abort_callback(self.request.id),
                config=config)
        # init progress to zero (for when retrying tasks)
        progress_func = get_progress_callback(self.request.id)
        progress_func(0)

        outdata = converter.convert(groundtruth.source_image.path.encode(),
                progress_func=progress_func, **params)        
        accuracy, details = utils.isri_accuracy(
                logger, 
                ocrutils.output_to_text(groundtruth.data),
                ocrutils.output_to_text(outdata))
        # there's be no details if something went wrong
        assert(details)
        task.parameter_score.score = accuracy
        task.parameter_score.score_internals = details.decode("unicode_escape")
        task.parameter_score.save()
        return outdata

        

