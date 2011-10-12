"""
Decorator for registering Celery fun classes with wrapper handlers.
"""

from celery.registry import tasks
from celery.signals import task_sent, task_prerun, \
        task_postrun, task_failure
from handlers import on_task_sent, on_task_prerun, \
        on_task_postrun, on_task_failure


def register_handlers(taskclass):
    task_sent.connect(on_task_sent, tasks[taskclass.name])
    task_prerun.connect(on_task_prerun, tasks[taskclass.name])
    task_postrun.connect(on_task_postrun, tasks[taskclass.name])
    task_failure.connect(on_task_failure, tasks[taskclass.name])
    return taskclass

