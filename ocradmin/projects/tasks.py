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
from django.utils.encoding import smart_str

from ocradmin.projects.models import OcrProject
from ocradmin.reference_pages.models import ReferencePage
from ocrtasks.models import OcrTask
from ocrtasks.decorators import register_handlers

from ocradmin.core import utils as ocrutils

from fedora.adaptor import fcobject, fcdatastream
from fedora.adaptor.utils import FedoraException


@register_handlers
class IngestTask(AbortableTask):
    """
    Ingest an image into a Fedora repository.
    """

    name = "fedora.ingest"
    max_retries = None
    
    def run(self, trainingpage_id, options, dublincore, **kwargs):
        """
        Ingest an image into fedora.
        """
        logger = self.get_logger()
        logger.info((trainingpage_id, options, dublincore, kwargs))
        task = OcrTask.objects.get(task_id=self.request.id)
        task.progess = 0
        task.save()

        trainingpage = ReferencePage.objects.get(pk=trainingpage_id)
        dublincore["title"] = trainingpage.page_name

        # TODO: Fix the Fedora library so you can actually specify
        # the pid in the constructor without it thinking you're
        # updating an existing object!
        fcobject.FedoraObject.NAMESPACE = options.get("namespace", "")
        fc = fcobject.FedoraObject(**options)
        fc.save()
        logger.info(fc._response.getBody())
        fc.set_dublincore(dublincore)
        with file(trainingpage.binary_image.path, "rb") as fd:
            if not fc.add_datastream("IMG", label=dublincore["title"], content=fd,
                    content_type="image/png"):
                raise FedoraException("Unable to add datastream.")
            task.progress = 50
            task.save()

        hocr = smart_str(ocrutils.output_to_hocr(trainingpage.data), 
                encoding="latin-1", errors="ignore")
        if not fc.add_datastream("HOCR", label="%s HOCR" % dublincore["title"], 
            content=hocr, content_type="text/html"):
            print fc._response.getBody().getContent()
            raise FedoraException("Unable to add datastream.")
        task.progress = 100
        task.save()
        logger.info("Ingested: %s" % fc.pid)
        return fc.pid



