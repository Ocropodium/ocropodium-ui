"""
Create default app models.  Models must be in the etc/defaultmodels directory
and be named thus:  <app>_other_stuff_<type>.extension, where <app> is either
'ocropus' or 'tesseract' and <type> is either 'char' or 'lang'.
"""

import os
import sys

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from ocradmin.ocrmodels.models import OcrModel
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import File

MODELDIR = "etc/defaultmodels"


class Command(BaseCommand):
    args = ""
    help = "Creates the default model db entries for Ocropus & Tesseract"

    def handle(self, *args, **options):
        try:
            adminuser = User.objects.get(is_superuser=True)
        except User.DoesNotExist:
            raise ImproperlyConfigured(
                    "An admin user must exist before default models can be added.")


        for fname in os.listdir(MODELDIR):
            if fname.startswith("."):
                continue
            basename = os.path.splitext(fname)[0]
            nameparts = basename.split("_")
            if not nameparts[0] in ("ocropus", "tesseract"):
                continue
            if not nameparts[-1] in ("char", "lang"):
                continue

            name = " ".join([p.title() for p in nameparts])
            try:
                exists = OcrModel.objects.get(name=name)
                exists.delete()
            except OcrModel.DoesNotExist:
                pass

            with open(os.path.join(MODELDIR, fname), "rb") as fh:
                model = OcrModel(
                    name=name,
                    app=nameparts[0],
                    type=nameparts[-1],
                    public=True,
                    tags=" ".join(nameparts),
                    user=adminuser,
                    file=File(fh, fname)
                )
                model.save()

