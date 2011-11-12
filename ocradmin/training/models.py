"""
Training-related database models.
"""

import os
import datetime
from django.db import models
from picklefield import fields
from ocradmin.reference_pages.models import ReferencePage
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.batch.models import Batch



class Score(models.Model):
    """
    A record of a job scoring a model on a given
    ground truth.
    """
    comparison = models.ForeignKey("Comparison",
            related_name="parameter_scores")
    name = models.CharField(max_length=255)
    task  = models.OneToOneField(OcrTask, related_name="parameter_score")
    ground_truth = models.ForeignKey(ReferencePage, related_name="parameter_scores")
    score = models.FloatField(null=True, blank=True)
    score_internals = models.TextField(blank=True)
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)
    error = fields.PickledObjectField(blank=True, null=True)

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(Score, self).save()


class Comparison(models.Model):
    """
    A comparison between two model scores
    """
    name = models.CharField(max_length=255)
    batch = models.OneToOneField(Batch)
    notes = models.TextField(blank=True)
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)

    def save(self):
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        super(Comparison, self).save()


