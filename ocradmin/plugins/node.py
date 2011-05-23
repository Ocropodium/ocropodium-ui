"""
Base class for OCR nodes.
"""

import logging
FORMAT = '%(levelname) %(name): %(message)s'
logging.basicConfig(format=FORMAT)
LOGGER = logging.getLogger()


def noop_abort_func(*args):
    return False

def noop_progress_func(*args):
    pass

class Node(object):
    """
    Node object.  Evaluates some input and
    return the output.
    """
    def __init__(self, abort_func=None, progress_func = None, logger=None):
        """
        Initialise a node.
        """
        if abort_func is not None:
            self.abort_func = abort_func
        else:
            self.abort_func = noop_abort_func
        if logger is not None:
            self.logger = logger
        else:
            self.logger = LOGGER
        if progress_func is not None:
            self.progress_func = progress_func
        else:
            self.progress_func = noop_progress_func
        self._params = {}

    def set_param(self, param, name):
        """
        Set a parameter.
        """
        self._params[param] = name

    def params(self):
        """
        Get all params.
        """
        return self._params

    def _set_p(self, p, v):
        """
        Set a parameter internally.
        """
        pass

    def _eval(self, input):
        """
        Perform actual processing.
        """
        pass

    def eval(self, input):
        """
        Eval the node.
        """
        for p, v in self._params.iteritems():
            self._set_p(p, v)
        return self._eval(input)

