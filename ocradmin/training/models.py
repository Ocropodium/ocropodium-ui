"""
Training-related database models.
"""

import os

from django.db import models
from picklefield import fields
from ocradmin.reference_pages.models import ReferencePage
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.batch.models import OcrBatch
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocr import utils as ocrutils



def reference_page_location(instance, filename):
    """
    Get the path for a given reference page.
    """
    username = instance.user.username
    project_id = instance.project.pk
    outpath = ocrutils.FileWrangler(
        username=username,
        project_id=project_id,
        reference=True,
        temp=False,
    )()
    if not os.path.exists(outpath):
        os.makedirs(outpath)
        os.chmod(outpath, 0777)
    return os.path.join(outpath, filename)



class ParameterScore(models.Model):
    """
    A record of a job scoring a model on a given
    ground truth.
    """
    comparison = models.ForeignKey("OcrComparison", 
            related_name="parameter_scores")
    name = models.CharField(max_length=255)
    task  = models.OneToOneField(OcrTask, related_name="parameter_score") 
    ground_truth = models.ForeignKey(ReferencePage)
    score = models.FloatField(null=True, blank=True)
    score_internals = models.TextField(null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    updated_on = models.DateTimeField(auto_now_add=True, 
            auto_now=True, editable=False)
    error = fields.PickledObjectField(blank=True, null=True)


class OcrComparison(models.Model):
    """
    A comparison between two model scores
    """
    name = models.CharField(max_length=255)
    batch = models.OneToOneField(OcrBatch)
    notes = models.TextField(null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)



