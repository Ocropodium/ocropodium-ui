import os

from django.db import models
from django.contrib.auth.models import User
from picklefield import fields
from ocradmin.projects.models import OcrProject
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
    user = models.ForeignKey(User)
    project = models.ForeignKey(OcrProject, related_name="training_sets")
    data = fields.PickledObjectField()
    binary_image_path = models.CharField(max_length=255)
    created_on = models.DateTimeField(auto_now_add=True, editable=False)

    class Meta:
        unique_together = ("project", "binary_image_path")
