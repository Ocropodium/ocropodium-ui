"""
Actions associated with the OCR Reference Page model.
"""

import os
from django.core.files.base import ContentFile
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseServerError 
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocrtasks.models import OcrTask
from ocradmin.reference_pages.models import ReferencePage        
from ocradmin.reference_pages.tasks import MakeThumbnailTask
from ocradmin.projects.utils import project_required


@project_required
@login_required
def list(request):
    """
    List the ref sets for the given project.
    """
    project = request.session["project"]
    context = dict(
        project=project,
        reference_sets=project.reference_sets.all(),
    )
    template = "reference_pages/list.html" if not request.is_ajax() \
            else "reference_pages/includes/reference_page_list.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))



@project_required
@login_required
def show(request, page_pk):
    """
    Show reference page info.
    """    
    refpage = get_object_or_404(ReferencePage, pk=page_pk)
    context = dict(refpage=refpage)
    template = "reference_pages/show.html" if not request.is_ajax() \
            else "reference_pages/includes/show_info.html"
    return render_to_response(template, context,
            context_instance=RequestContext(request))


@project_required
@login_required
def delete(request, page_pk):
    """
    Delete a reference page.
    """
    tpage = get_object_or_404(ReferencePage, pk=page_pk)
    tpage.delete()
    return HttpResponseRedirect("/reference_pages/list")


@project_required
@login_required
def create_from_task(request, task_pk):
    """
    Save a page and it's binary image as 
    reference data.
    """
    task = get_object_or_404(OcrTask, pk=task_pk)

    srcpath = task.args[0]
    binurl = request.POST.get("binary_image")
    if not binurl:
        raise HttpResponseServerError("No binary image url given.")
    binpath = ocrutils.media_url_to_path(binurl)
    if not os.path.exists(binpath):
        raise HttpResponseServerError("Binary image does not exist")

    # create or update the model
    try:
        tpage = ReferencePage.objects.get(
            project=request.session["project"],
            page_name=task.page_name
        )
    except ReferencePage.DoesNotExist:
        # create a new one
        tpage = ReferencePage(
            page_name=task.page_name,
            project=request.session["project"],
            user=request.user
        )
        tpage.source_image.save(os.path.basename(srcpath),
                ContentFile(open(srcpath, "rb").read()))
        tpage.binary_image.save(os.path.basename(binpath),
                ContentFile(open(binpath, "rb").read()))

    tpage.data = task.latest_transcript()
    tpage.save()
    
    # try and create a thumbnail of the file
    MakeThumbnailTask.apply_async((tpage.source_image.path, 
            settings.THUMBNAIL_SIZE), queue="interactive", retries=2)
    
    return HttpResponse(simplejson.dumps({"ok": True, "pk": tpage.pk}),
            mimetype="application/json")

    

