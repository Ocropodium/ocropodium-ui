import re
import os
import traceback
from types import ClassType, MethodType
from datetime import datetime
from celery import result as celeryresult
from celery.contrib.abortable import AbortableAsyncResult
from celery.task.sets import TaskSet, subtask
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core import serializers
from django.core.paginator import Paginator, InvalidPage, EmptyPage
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect, Http404, HttpResponseServerError 
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.ocr import tasks
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocrtasks.models import OcrTask, OcrBatch, Transcript
from ocradmin.ocrtraining.models import TrainingPage

from ocradmin.projects.utils import project_required




@project_required
@login_required
def save_task(request, pk):
    """
    Save a page and it's binary image as 
    training data.
    """
    task = get_object_or_404(OcrTask, pk=pk)
    binurl = request.POST.get("binary_image")
    if not binurl:
        raise HttpResponseServerError("No binary image url given.")
    binpath = ocrutils.media_url_to_path(binurl)
    if not os.path.exists(binpath):
        raise HttpResponseServerError("Binary image does not exist")

    outpath = ocrutils.FileWrangler(
        username=request.user.username,
        project_id=request.session["project"].pk,
        training=True,
        temp=False,
    )()
    if not os.path.exists(outpath):
        os.makedirs(outpath)
        os.chmod(outpath, 0777)
    trainpath = os.path.join(outpath, os.path.basename(binpath))
    import shutil
    shutil.copy2(binpath, trainpath)
    
    try:
        tp = TrainingPage(
            user=request.user,
            project=request.session["project"],
            lines=task.latest_transcript(),
            binary_image_path=trainpath,            
        )
        tp.save()
    except IntegrityError, e:
        return HttpResponse(simplejson.dumps({"error": str(e)}),
                mimetype="application/json")


    return HttpResponse(simplejson.dumps({"ok": True}),
            mimetype="application/json")

    

