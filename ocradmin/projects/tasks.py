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
from ocradmin.reference_pages.models import ReferencePage
from ocrtasks.models import OcrTask

from ocradmin.core import utils as ocrutils

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
        logger = self.get_logger()
        logger.info((trainingpage_id, namespace, kwargs))
        task = OcrTask.objects.get(task_id=self.request.id)
        task.progess = 0
        task.save()

        trainingpage = ReferencePage.objects.get(pk=trainingpage_id)
        dublincore["title"] = trainingpage.page_name

        imagedata = trainingpage.binary_image.open(mode="rb")
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
        task.progress = 50
        task.save()

        hocr = ocrutils.output_to_hocr(trainingpage.data)
        if not fc.add_datastream("HOCR", label="%s HOCR" % dublincore["title"], 
            content=hocr.encode("latin-1", "replace"), content_type="text/html"):
            raise FedoraException("Unable to add datastream.")
        task.progress = 100
        task.save()
        logger.info("Ingested: %s" % fc.pid)
        return fc.pid



