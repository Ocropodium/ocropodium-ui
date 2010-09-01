import os

from django.db import models
from django.contrib.auth.models import User
from picklefield import fields
from ocradmin.projects.models import OcrProject
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.batch.models import OcrBatch
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocr import utils as ocrutils



def training_page_location(instance, filename):
    """
    Get the path for a given training page.
    """
    username = instance.user.username
    project_id = instance.project.pk
    outpath = ocrutils.FileWrangler(
        username=username,
        project_id=project_id,
        training=True,
        temp=False,
    )()
    if not os.path.exists(outpath):
        os.makedirs(outpath)
        os.chmod(outpath, 0777)
    return os.path.join(outpath, filename)



class TrainingPage(models.Model):
    """
    Single page of training data, i.e: text lines
    with geometry and a corresponding binary
    image.
    """
    page_name = models.CharField(max_length=255)
    user = models.ForeignKey(User)
    project = models.ForeignKey(OcrProject, related_name="training_sets")
    data = fields.PickledObjectField()
    binary_image_path = models.CharField(max_length=255)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    updated_on = models.DateTimeField(auto_now=True, editable=False)

    class Meta:
        unique_together = ("project", "binary_image_path")

    def binary_image_url(self):
        """
        Url to image resource.
        """
        return ocrutils.media_path_to_url(self.binary_image_path)

    def thumbnail_path(self):
        """
        Path to where the thumbnail should be.
        """
        return "%s.thumb.jpg" % os.path.splitext(self.binary_image_path)[0] 

    def thumbnail_url(self):
        """
        Url to thumbnail resource.
        """
        return ocrutils.media_path_to_url(self.thumbnail_path())


class OcrModelScore(models.Model):
    """
    A record of a job scoring a model on a given
    ground truth.
    """
    comparison = models.ForeignKey("OcrModelScoreComparison", 
            related_name="modelscores")
    model = models.ForeignKey(OcrModel, related_name="comparisons")
    task  = models.OneToOneField(OcrTask, related_name="modelscore") 
    ground_truth = models.ForeignKey(TrainingPage)
    score = models.FloatField(null=True, blank=True)
    score_internals = models.TextField(null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)
    updated_on = models.DateTimeField(auto_now_add=True, auto_now=True, editable=False)
    error = fields.PickledObjectField(blank=True, null=True)


class OcrModelScoreComparison(models.Model):
    """
    A comparison between two model scores
    """
    name = models.CharField(max_length=255)
    batch = models.ForeignKey(OcrBatch)
    notes = models.TextField(null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)



