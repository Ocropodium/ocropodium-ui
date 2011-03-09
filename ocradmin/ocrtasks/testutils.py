"""
Utils for testing the Ocr Task wrapper.
"""


from celery.contrib.abortable import AbortableTask
from decorators import register_handlers


@register_handlers
class TestTask(AbortableTask):
    """
    Dummy task for running tests on.
    """
    name = "testing.test"
    max_retries = None

    def run(self, a, b, **kwargs):
        return a + b
        
