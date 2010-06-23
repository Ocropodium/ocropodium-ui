"""
Callbacks to run when certain celery signals are recieved in response
to the ConvertPageTask.
"""

from celery.registry import tasks
from celery.signals import task_sent, task_prerun, task_postrun

from ocradmin.ocr.tasks import ConvertPageTask 
from ocradmin.ocrtasks.models import OcrTask


def on_task_sent(**kwargs):
    """
    Update the database when a task is sent to the broker.
    """
    ocrtask = OcrTask.objects.get(task_id=kwargs.get("task_id"))
    ocrtask.status = "PENDING"
    ocrtask.save()


def on_task_prerun(**kwargs):
    """
    Update the database when a task is about to run.
    """
    ocrtask = OcrTask.objects.get(task_id=kwargs.get("task_id"))
    ocrtask.args = kwargs.get("args")
    ocrtask.kwargs = kwargs.get("kwargs")
    ocrtask.status = "RUNNING"
    ocrtask.save()


def on_task_postrun(**kwargs):
    """
    Update the database when a task is finished.
    """
    # don't know what we need to do here yet
    ocrtask = OcrTask.objects.get(task_id=kwargs.get("task_id"))
    ocrtask.status = "DONE"
    ocrtask.save()

# Connect up signals to the ConvertPageTask
task_sent.connect(on_task_sent, tasks[ConvertPageTask.name])
task_prerun.connect(on_task_prerun, tasks[ConvertPageTask.name])
task_postrun.connect(on_task_postrun, tasks[ConvertPageTask.name])



