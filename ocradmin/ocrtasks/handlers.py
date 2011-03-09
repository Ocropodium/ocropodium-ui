"""
Callbacks to run when certain celery signals are recieved in response
to the ConvertPageTask.
"""

from models import OcrPageTask, Transcript
from celery.datastructures import ExceptionInfo

def on_task_sent(**kwargs):
    """
    Update the database when a task is sent to the broker.
    """
    task = OcrPageTask.objects.get(task_id=kwargs.get("task_id"))
    print task
    task.status = "PENDING"
    task.save()


def on_task_prerun(**kwargs):
    """
    Update the database when a task is about to run.
    """
    task = OcrPageTask.objects.get(task_id=kwargs.get("task_id"))
    task.status = "STARTED"
    task.save()


def on_task_postrun(**kwargs):
    """
    Update the database when a task is finished.  Create a new 
    transcript entry with the retval of the task.
    """
    task = OcrPageTask.objects.get(task_id=kwargs.get("task_id"))
    retval = kwargs.get("retval", "")
    if not isinstance(retval, ExceptionInfo):
        result = Transcript(task=task, data=retval)
        result.save()
        task.status = "SUCCESS"
    task.save()


def on_task_failure(**kwargs):
    """
    Store the exception and traceback when a task
    fails.
    """
    task = OcrPageTask.objects.get(task_id=kwargs.get("task_id"))
    task.error = kwargs.get("exception")
    task.traceback = kwargs.get("traceback")
    task.status = "FAILURE"
    task.save()


