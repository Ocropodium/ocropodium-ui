"""
Celery functions to be processed in a non-blocking distributed manner.
"""

import os
import re
import shutil
import time
from celery.contrib.abortable import AbortableTask
from celery.contrib.abortable import AbortableAsyncResult
from datetime import datetime, timedelta
from django.conf import settings

from ocradmin.projects.models import OcrProject
from ocradmin.training.models import TrainingPage
from ocrtasks.models import OcrTask

from fedora.adaptor import fcobject, fcdatastream
from fedora.adaptor.utils import FedoraException



class IngestTask(AbortableTask):
    """
    Ingest an image into a Fedora repository.
    """

    name = "fedora.ingest"
    max_retries = None
    
    def run(self, trainingpage_id, namespace, dublincore, **kwargs):
        """
        Ingest an image into fedora.
        """
        logger = self.get_logger(**kwargs)
        logger.info((trainingpage_id, namespace, kwargs))
        task = OcrTask.objects.get(task_id=kwargs["task_id"])
        task.progess = 0
        task.save()

        trainingpage = TrainingPage.objects.get(pk=trainingpage_id)
        dublincore["title"] = trainingpage.page_name

        imagedata = open(trainingpage.binary_image_path, "rb")
        # TODO: Fix the Fedora library so you can actually specify
        # the pid in the constructor without it thinking you're
        # updating an existing object!
        fcobject.FedoraObject.NAMESPACE = namespace
        fc = fcobject.FedoraObject()
        fc.save()
        logger.info(fc._response.getBody())
        fc.set_dublincore(dublincore)
        if not fc.add_datastream("IMG", label=dublincore["title"], content=imagedata,
            content_type="image/png"):
            raise FedoraException("Unable to add datastream.")
        imagedata.close()
        task.progress = 100
        task.save()
        logger.info("Ingested: %s" % fc.pid)
        return fc.pid



