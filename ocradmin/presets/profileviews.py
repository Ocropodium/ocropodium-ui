"""
Interface to interacting with OCR preset profiles.
"""

from django import forms
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render

from ocradmin.core import generic_views as gv

from ocradmin.presets.models import Preset, Profile

class ProfileForm(forms.ModelForm):
    """
        Base profile form
    """
    def __init__(self, *args, **kwargs):
        super(ProfileForm, self).__init__(*args, **kwargs)
        # change a widget attribute:
        self.fields['description'].widget.attrs["rows"] = 2
        self.fields['description'].widget.attrs["cols"] = 40        

    class Meta:
        model = Profile
        fields = ["name", "tags", "description", "data"]
        exclude = ["created_on", "updated_on"]


profilelist = gv.GenericListView.as_view(
        model=Profile,
        page_name="OCR Profiles",
        fields=["name", "description", "user", "created_on"],)


profilecreate = gv.GenericCreateView.as_view(
        model=Profile,
        form_class=ProfileForm,
        page_name="New OCR Profile",)


profiledetail = gv.GenericDetailView.as_view(
        model=Profile,
        page_name="OCR Profile",
        fields=["name", "description", "user", "public", "tags", "created_on",
            "updated_on",])


profileedit = gv.GenericEditView.as_view(
        model=Profile,
        form_class=ProfileForm,
        page_name="Edit OCR Profile",)


profiledelete = gv.GenericDeleteView.as_view(
        model=Profile,
        page_name="Delete OCR Profile",
        success_url="/profiles/list/",)



