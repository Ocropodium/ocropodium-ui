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
from ocradmin.core import utils as ocrutils



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



