"""
Base class for OCR nodes.
"""

import logging
FORMAT = '%(levelname) %(name): %(message)s'
logging.basicConfig(format=FORMAT)
LOGGER = logging.getLogger()


def UnsetParameterError(StandardError):
    pass

def noop_abort_func(*args):
    return False

def noop_progress_func(*args):
    pass

class Node(object):
    """
    Node object.  Evaluates some input and
    return the output.
    """
    _arity = 1

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
        self._cache = None
        self._inputs = [None for n in range(self._arity)]

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

    def _eval(self):
        """
        Perform actual processing.
        """
        pass

    def set_input(self, num, node):
        """
        Set an input.

        num: 0-based input number
        node: input node
        """
        if num > len(self._inputs) - 1:
            raise InputOutOfRange(self._name)
        self._inputs[num] = node

    def mark_dirty(self):
        """
        Tell the node it needs to reevaluate.
        """
        self._cache = None

    def eval_input(self, num):
        """
        Eval an input node.
        """
        return self._inputs[num].eval()

    def eval(self):
        """
        Eval the node.
        """
        for p, v in self._params.iteritems():
            self._set_p(p, v)
        if self._cache is not None:
            return self._cache
        else:
            self._cache = self._eval()
        return self._cache

