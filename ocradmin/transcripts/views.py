# Create your views here.

from django import forms
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from ocradmin.core import generic_views as gv
from ocradmin.transcripts.models import Transcript



class TranscriptForm(forms.ModelForm):
    """
        Base preset form
    """
    class Meta:
        model = Transcript
        exclude = ["created_on", "updated_on"]


transcriptlist = gv.GenericListView.as_view(
        model=Transcript,
        page_name="OCR Transcripts",
        fields=["id", "task.page_name", "task.user", "created_on"],)


transcriptdetail = gv.GenericDetailView.as_view(
        model=Transcript,
        page_name="OCR Transcript",
        fields=["id", "task.page_name", "task.user", "created_on",
            "updated_on",])


transcriptedit = gv.GenericEditView.as_view(
        model=Transcript,
        form_class=TranscriptForm,
        page_name="Edit OCR Transcript",)


transcriptdelete = gv.GenericDeleteView.as_view(
        model=Transcript,
        page_name="Delete OCR Transcript",
        success_url="/transcripts/list/",)


def transcript(request, pk):
    """
    View a transcripts data.
    """
    transcript = get_object_or_404(Transcript, pk=pk)
    return HttpResponse(transcript.data, mimetype="text/html")
