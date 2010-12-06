"""
Web service for generic image operations.
"""

import os
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseServerError, Http404
from django.shortcuts import render_to_response

from PIL import Image


@login_required
def scale(request):
    """
    Scale an image from a given disk path and return the raw data.
    For the moment we're going to put up with a bit settings
    munging MEDIA_PATH <-> MEDIA_URL
    """
    imageurl = request.GET.get("image")
    if not imageurl:
        raise Http404

    mediapath = os.path.abspath(
            imageurl.replace(settings.MEDIA_URL, settings.MEDIA_ROOT + "/"))
    # TODO: Make sure image type is one of a few sensible values
    imagetype = os.path.splitext(imageurl)[1].lower() or "png"
    if imagetype.startswith("."):
        imagetype = imagetype[1:]
    
    try:
        pil = Image.open(mediapath)
    except Exception, err:
        # fall back on GraphicsMagick if opening fails
        print err
        import subprocess as sp
        import tempfile
        fhandle, path  = tempfile.mktemp(suffix=".png")
        fhandle.close()
        sp.call(["convert", mediapath, path])
        pil = Image.open(path)

    # initialise response object to write to 
    response = HttpResponse(mimetype="image/png") 

    # if we don't have a width or height just return the rewritten data
    width = int(request.GET.get("w", -1))
    height = int(request.GET.get("h", -1))
    if width == -1 and height == -1:        
        pil.save(response, "PNG")
        return response

    if height == -1:
        newsize = _new_size_from_width(pil.size, width)
    elif width == -1:
        newsize = _new_size_from_height(pil.size, height)
    else:
        newsize = (width, height)

    pil.resize(newsize, Image.ANTIALIAS).save(response, "PNG")
    return response


       
    


def _new_size_from_width(csize, width):
    """
    Scale maintaining aspect ratio based on width.
    """
    caspect = float(csize[0]) / float(csize[1])
    return width, int(float(width) / caspect)


def _new_size_from_height(csize, height):
    """
    Scale maintaining aspect ratio based on height.
    """
    caspect = float(csize[0]) / float(csize[1])
    return int(float(height) * caspect), height




