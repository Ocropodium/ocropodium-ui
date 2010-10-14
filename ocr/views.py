"""
Basic OCR functions.  Submit OCR tasks and retrieve the result.
"""

import re
import os
import traceback
from celery import result as celeryresult
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response
from django.template import RequestContext
from django.utils import simplejson
from ocradmin.ocr import tasks
from ocradmin.ocr import utils as ocrutils
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocrpresets.models import OcrPreset
from ocradmin.ocrtasks.models import OcrTask 


class AppException(StandardError):
    """
    Most generic app error.
    """
    pass


@login_required
def index(request):
    """
    OCR index page.
    """
    return HttpResponseRedirect("/ocr/convert/")



@login_required
@transaction.commit_manually
def binarize(request):
    """
        Save a posted image to the DFS.  Binarize it with Celery.
    """

    return _ocr_task(
        request,
        "ocr/binarize.html",
        {},
        "Binarize",
        tasks.BinarizePageTask,
    )



@login_required
@transaction.commit_manually
def convert(request):
    """
    Save a posted image to the DFS and convert it with Celery.
    """

    # add available seg and bin presets to the context
    context = {
        "binpresets": OcrPreset.objects.filter(
            type="binarize").order_by("name"),
        "segpresets": OcrPreset.objects.filter(
            type="segment").order_by("name"),
    }

    return _ocr_task(
        request,
        "ocr/convert.html",
        context,
        "Convert",
        tasks.ConvertPageTask,
    )


@login_required
@transaction.commit_manually
def segment(request):
    """
        Save a posted image to the DFS.  Segment it with Celery.
    """

    # add available seg and bin presets to the context
    context = {
        "binpresets": OcrPreset.objects.filter(
            type="binarize").order_by("name"),
    }

    return _ocr_task(
        request,
        "ocr/segment.html",
        context,
        "Segment",
        tasks.SegmentPageTask,
    )


@login_required
def results(request, job_name):
    """
    Retrieve the results using the previously provided task name.
    """
    async = celeryresult.AsyncResult(job_name)
    if async is None:
        raise Http404

    return _format_task_results(request, async)


@login_required
def zipped_results(request):
    """
    Send back quicky results for several
    pages in a zip.
    """
    ctasks = request.GET.getlist("task")
    import cStringIO, gzip
    zbuf = cStringIO.StringIO()
    zfile = gzip.GzipFile(mode='wb', compresslevel=6, fileobj=zbuf)
    for task in ctasks:
        async = celeryresult.AsyncResult(task)
        data = _json_or_text_data(
            request, {
                "job_name": async.task_id,
                "status": async.status,
                "results": async.result
            }
        )[0]        
        zfile.write(data)
    zfile.close()

    compressed_content = zbuf.getvalue()
    response = HttpResponse(compressed_content)
    response['Content-Encoding'] = 'application/octet-stream'
    response['Content-Length'] = str(len(compressed_content))
    response['Content-Disposition'] = "attachment; filename=results.tar.gz;"
    return response


@login_required
def components(request):
    """
    List OCRopus components - either all or those
    of an optional type.
    """
    comps = ocrutils.get_ocropus_components(
            request.GET.getlist("type"), request.GET.getlist("name"))
    return HttpResponse(simplejson.dumps(comps), mimetype="application/json")


def test(request, ids):
    """
    Dummy action for running JS unit tests.  Probably needs to
    be put somewhere else.
    """

    print "ARGS: %s" % ids
    return render_to_response("ocr/test.html", {})


def _ocr_task(request, template, context, tasktype, celerytask):
    """
    Generic handler for OCR tasks which run a celery job.
    """
    if not request.method == "POST":
        return render_to_response(template, context, 
                        context_instance=RequestContext(request))

    # save our files to the DFS and return a list of addresses
    outdir = ocrutils.FileWrangler(
            username=request.user.username, temp=True, 
            action=tasktype.lower())()

    try:
        paths, userparams = _handle_request(request, outdir)
    except AppException, err:
        return HttpResponse(simplejson.dumps({"error": err.message}),
            mimetype="application/json")
    if not paths:
        return HttpResponse(
                simplejson.dumps({"error": "no valid images found"}),
                mimetype="application/json")     

    # init the job from our params
    asynctasks = []
    for path in paths:
        tid = ocrutils.get_new_task_id()
        args = (path.encode(), outdir.encode(), userparams)
        kwargs = dict(task_id=tid, loglevel=60, retries=2, queue="interactive")
        ocrtask = OcrTask(
            task_id=tid,
            user=request.user,
            page_name=os.path.basename(path),
            task_name=celerytask.name,
            status="INIT",
            args=args,
            kwargs=kwargs,
        )
        ocrtask.save()
        asynctasks.append(
            (os.path.basename(path), celerytask.apply_async(args=args, **kwargs))
        )
    try:
        # aggregate the results.  If necessary wait for tasks.
        out = []
        for pagename, async in asynctasks:
            result = async.wait() if _should_wait(request) else async.result
            out.append({
                "page_name": pagename,
                "job_name": async.task_id,
                "status": async.status,
                "results": result,
            })
        # should be past the danger zone now...
        transaction.commit()
        return _json_or_text_response(request, out)
    except Exception, err:
        print err
        transaction.rollback()
        return HttpResponse(
            simplejson.dumps({
                "error": err.message, 
                "trace": "\n".join(
                    [ "\t".join(str(t)) for t in traceback.extract_stack()]
                )
            }),
            mimetype="application/json"
        ) 




def _format_task_results(request, async):
    """
    Wrap the results in JSON metadata.  Treat
    exceptions as a special case.
    """
    if async.status == "FAILURE":
        err = async.result
        taskmeta = OcrTask.objects.get(task_id=async.task_id)
        return HttpResponse(
            simplejson.dumps({
                "error": err.message, 
                "trace": taskmeta.traceback
            }),
            mimetype="application/json"
        )
    return _json_or_text_response(
        request, {
            "job_name": async.task_id,
            "status": async.status,
            "results": async.result
        }
    )



def _wants_text_format(request):
    """
    Determine whether we should send back plain text instead of JSON.
    """    
    return request.META.get("HTTP_ACCEPT", "") == "text/plain" \
        or request.GET.get("format", "") == "text" \
        or request.POST.get("format", "") == "text"


def _wants_png_format(request):
    """
    Determine whether to send back an image rather than JSON.
    (For binarisation/segmentation.
    """
    return (request.META.get("HTTP_ACCEPT", "") == "image/png" \
        or request.GET.get("format", "") == "png" \
        or request.POST.get("format", "") == "png")



def _should_wait(request):
    """
    Determine if we should block waiting for the results.  The
    default is to not block.
    """
    return request.GET.get("wait", False)


def _json_or_text_data(request, json):
    """
    Format the output string accordingly.
    """
    mimetype = "application/json"

    # bad code alert!  if uploaded via the dodgy
    # Ajax iframe method, force a text response
    # otherwise firefox eats the results for us...
    if request.POST.get("_iframe"):
        mimetype = "text/html"

    if _wants_png_format(request):
        if isinstance(json, dict):
            json = [json]
        mimetype = "image/png"
        try:
            path = ocrutils.media_url_to_path(
                    json[0]["results"]["out"])
            result = open(path, "rb").read()
        except (IndexError, KeyError), err:
            result = ""
            raise err
    elif _wants_text_format(request):
        if isinstance(json, dict):
            json = [json]
        mimetype = "text/plain"
        result = ""
        for page in json:
            if page.get("results"):
                result += ocrutils.output_to_plain_text(page.get("results"))
                result += "\n"
    else:
        result = simplejson.dumps(json)
    return result, mimetype


def _json_or_text_response(request, json):
    """
    Return the appropriate mimetype
    """
    result, mimetype = _json_or_text_data(request, json)
    return HttpResponse(result, mimetype=mimetype)


def _handle_request(request, outdir):
    """
    Save files and extract parameters.  How this happens
    depends on how the file was send - either multipart
    of as the whole POST body.
    """

    if request.GET.get("inlinefile"):
        return _handle_streaming_upload(request, outdir)
    else:
        return _handle_multipart_upload(request, outdir)


def _handle_streaming_upload(request, outdir):
    """
    Handle an upload where the params are in GET and
    the whole of the POST body consists of the file.
    """
    fpath = os.path.join(outdir, request.GET.get("inlinefile"))
    tmpfile = file(fpath, "wb")
    tmpfile.write(request.raw_post_data)
    tmpfile.close()
    return [fpath], _get_best_params(request.GET.copy())


def _handle_multipart_upload(request, outdir):
    """
    Handle an upload where the file data is multipart
    encoded in the POST body, along with the params.
    """
    if request.POST.get("png"):
        paths = [ocrutils.media_url_to_path(request.POST.get("png"))]
    else:
        paths = ocrutils.save_ocr_images(request.FILES.iteritems(), outdir)
    return paths, _get_best_params(request.POST.copy())



def _get_preset_data(param):
    """
    Fetch a preset by primary key and return its data
    dict for merging into OCR params.  Try to get the
    preset via primary key (as used via the web UI) 
    or name (as used via Curl).
    """
    pmatch = re.match("preset_(\d+)", param)
    data = None
    #keyval = {}
    if pmatch:
        keyval = dict(pk=pmatch.groups()[0])
    else:
        keyval = dict(name=param)

    try:
        preset = OcrPreset.objects.get(**keyval)
        data = preset.data
    except OcrPreset.DoesNotExist:
        pass
    return data


def _cleanup_params(postdict, unused):
    """
    Remove anything in the params that we don't want
    to store as part of the convert job.  Note: the
    dict param IS mutable.
    """
    for param in unused:
        try:
            del postdict[param]
        except KeyError:
            pass
    return postdict


def _get_best_params(postdict, with_prefix=None):
    """
    Attempt to determine the best params if not specified in
    POST.  This is contingent on data in the models table.
    TODO: Make this less horrible
    """

    userparams = {}
    cleanedparams = {}
    if with_prefix is not None:
        for key, value in postdict.iteritems():
            if key.startswith(with_prefix):
                cleanedparams[key.replace(with_prefix, "", 1)] = value
        if len(cleanedparams) == 0:
            return {}
    else:                
        cleanedparams = userparams = postdict.copy()    

    # default to tesseract if no 'engine' parameter...
    userparams["engine"] = cleanedparams.get("engine", "tesseract")

    # get the bin and seg params.  These are either dicts or default strings
    segparam = cleanedparams.get("psegmenter", "SegmentPageByRAST")
    segdata = _get_preset_data(segparam)
    if segdata:
        userparams.update(segdata)
    else:
        userparams["psegmenter"] = segparam

    binparam = cleanedparams.get("clean", "StandardPreprocessing")
    bindata = _get_preset_data(binparam)
    if bindata:
        userparams.update(bindata)
    else:
        userparams["clean"] = binparam

    # get the lmodel/cmodel, either model object paths or defaults
    for modparam in ("cmodel", "lmodel"):
        try:
            model = OcrModel.objects.get(name=userparams.get(modparam, "???"))
            userparams[modparam] = model.file.path            
        except OcrModel.DoesNotExist:
            # try and choose the best model accordingly - this is a model
            # named "Default Something"
            modtype = "char" if modparam == "cmodel" else "lang"
            try:
                model = OcrModel.objects.filter(
                    name__icontains="default",
                    app__iexact=userparams["engine"],
                    type__iexact=modtype,
                )[0]
                userparams[modparam] = model.file.path            
            except IndexError:
                userparams[modparam] = "???" 

    return userparams    
