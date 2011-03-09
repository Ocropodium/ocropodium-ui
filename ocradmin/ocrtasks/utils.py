"""
Utilities for managing OcrPageTasks.
"""

from celery.contrib.abortable import AbortableAsyncResult
from models import OcrPageTask



def get_progress_callback(task_id):
    """
    Closure for generating a function that refers to
    a task id in outer scope.
    """
    def progress_func(progress, lines=None):
        """
        Set progress for the given task.
        """
        task = OcrPageTask.objects.get(task_id=task_id)
        task.progress = progress
        if lines is not None:
            task.lines = lines
        task.save()
    return progress_func


def get_abort_callback(task_id):
    """
    Closure for generating a function that takes
    no params but uses a task_id in outer scope.
    """
    def abort_func():
        """
        Check whether the task in question has been aborted.
        """
        asyncres = AbortableAsyncResult(task_id)
        return asyncres.is_aborted()
    return abort_func



