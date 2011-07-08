"""
OCR Transcript model
"""

import datetime
from django.db import models
from ocradmin.ocrtasks.models import OcrTask


class Transcript(models.Model):
    """
    
    """
    task = models.ForeignKey(OcrTask, related_name="transcripts")
    version = models.IntegerField(default=0, editable=False)
    data = models.TextField()
    is_retry = models.BooleanField(default=False, editable=False)
    is_final = models.BooleanField(default=False)
    created_on = models.DateTimeField(editable=False)
    updated_on = models.DateTimeField(blank=True, null=True, editable=False)


    def save(self, force_insert=False, force_update=False):
        """
        Override save method to create the version number automatically.
        """
        if not self.id:
            self.created_on = datetime.datetime.now()
        else:
            self.updated_on = datetime.datetime.now()
        if self.version == 0:
            # increment version number
            try:
                recent = Transcript.objects.filter(
                        task__exact=self.task).order_by("-version")[0]
                self.version = recent.version + 1
            except IndexError:
                self.version = 1
        # if final, set other transcripts for the same task to not final
        if self.is_final:
            others = Transcript.objects.filter(
                    task__exact=self.task).exclude(
                            version=self.version).update(is_final=False)
        # Call the "real" save() method
        super(Transcript, self).save(force_insert, force_update)


