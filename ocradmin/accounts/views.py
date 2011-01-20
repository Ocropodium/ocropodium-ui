# Account handling actions.

from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response
from django.template import RequestContext
from django.contrib import auth

def login(request):
    """
        Log a user in.
    """
    if request.method != "POST":
        if request.user.is_authenticated():
            return HttpResponseRedirect("/ocr/")
        else:
            return render_to_response("accounts/login.html", context_instance=RequestContext(request))
    # postback from form
    next = request.META.get("HTTP_REFERER", "/ocr/")
    username = request.POST.get("username", "")
    password = request.POST.get("password", "")
    user = auth.authenticate(username=username, password=password)
    if user is not None and user.is_active:
        # Logged in ok!
        auth.login(request, user)
        return HttpResponseRedirect(next)
    else:
        return render_to_response(
            "accounts/login.html",
            {"nextpage": next, "error": "Invalid username or password"},
            context_instance=RequestContext(request)
        )

    


def logout(request):
    """
        Log a user out.
    """
    auth.logout(request)
    return HttpResponseRedirect("/accounts/login")


def unauthorised(request):
    """
        Show an authorisation error.
    """

    return render_to_response("accounts/unauthorised.html", context_instance=RequestContext(request))
