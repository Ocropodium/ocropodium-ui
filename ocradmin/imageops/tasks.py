"""
Celery functions to be processed in a non-blocking distributed manner.
"""

import os
import re
import shutil
import time
from celery.task import Task
from datetime import datetime, timedelta
from django.conf import settings


class ImageOpTask(Task):
    """
    Run some generic image function on the celery farm.
    """

    name = "image.op"

    def run(self, filepath, paramdict, **kwargs):
        """
        Runs the convert action.
        """

        return {} 

