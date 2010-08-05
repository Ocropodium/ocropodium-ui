from django.db import models
from django.contrib.auth.models import User
from tagging.fields import TagField


class OcrBatch(models.Model):
    """
    OCR Batch object.
    """
    TYPE_CHOICES = (
        ("ONESHOT", "One-Shot"),
        ("BATCH", "Batch"),
        ("TEST", "Test"),
    )

    user = models.ForeignKey(User)
    name = models.CharField(max_length=255)
    task_type = models.CharField(max_length=100)
    batch_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField(blank=True, null=True)
    tags = TagField()
    created_on = models.DateTimeField(auto_now_add=True, editable=False)

    def subtasks(self):
        """
        Alias for 'tasks', for use when serializing
        """
        return self.tasks.all()



    def estimate_progress(self):
        """
        Aggregated percentage of how many tasks
        are complete.  This is going to be a bit
        of an estimate and does not take account
        of stages where progress is difficult to
        measure, i.e. segmentation.
        """
        totallines = 0
        percentdone = 0
        tasks = self.tasks.all()
        for t in tasks:
            totallines += t.lines or 50
        if totallines == 0:
            return 0
        for t in tasks:
            lines = t.lines or 50
            weight = float(lines) / float(totallines)
            if t.status == "ERROR":
                percentdone += (weight * 100)            
            else:
                percentdone += (weight * t.progress)            
        return min(100.0, percentdone)




