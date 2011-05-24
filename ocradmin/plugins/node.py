"""
Base class for OCR nodes.
"""

import logging
FORMAT = '%(levelname)-5s %(name)s: %(message)s'
logging.basicConfig(format=FORMAT)
LOGGER = logging.getLogger("Node")
LOGGER.setLevel(logging.DEBUG)


def UnsetParameterError(StandardError):
    pass

def InvalidParameterError(StandardError):
    pass

def CircularDagError(StandardError):
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
    name = "node"
    description = "Base node"
    arity = 1
    stage = "general"
    _parameters = [

    ]

    def __init__(self, label=None, abort_func=None, progress_func=None, logger=None):
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
        self.label = label
        self._cache = None
        self._parents = []
        self._inputs = [None for n in range(self.arity)]

    @classmethod
    def parameters(cls):
        return cls._parameters

    def set_param(self, param, name):
        """
        Set a parameter.
        """
        self._params[param] = name

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

    def add_parent(self, n):
        """
        Add a parent node.
        """
        if self == n:
            raise CircularDagError("Node added as parent to self")
        if not n in self._parents:
            self._parents.append(n)

    def has_parents(self):
        """
        Check if the node is a terminal node
        or if there's a tree further down.
        """
        return bool(len(self._parents))

    def set_input(self, num, n):
        """
        Set an input.

        num: 0-based input number
        node: input node
        """
        if num > len(self._inputs) - 1:
            raise InputOutOfRange(self._name)
        n.add_parent(self)
        self._inputs[num] = n

    def mark_dirty(self):
        """
        Tell the node it needs to reevaluate.
        """
        self.logger.debug("%s marked dirty", self)
        for parent in self._parents:
            parent.mark_dirty()
        self._cache = None

    def set_cache(self, cache):
        """
        Set the cache on a node, preventing it
        from eval'ing its inputs.
        """
        self._cache = cache

    def eval_input(self, num):
        """
        Eval an input node.
        """
        return self._inputs[num].eval()

    def validate(self):
        """
        Check params are present and correct.
        """
        pass

    def eval(self):
        """
        Eval the node.
        """
        self.logger.debug("Evaluating '%s' Node", self)
        if self._cache is not None:
            self.logger.debug("%s returning cached input", self)
            return self._cache
        self.validate()
        for p, v in self._params.iteritems():
            self.logger.debug("Set Param %s.%s -> %s",
                    self, p, v)
            self._set_p(p, v)            
        self._cache = self._eval()
        return self._cache

    def __repr__(self):
        return "<Node: %s" % self.name

    def __str__(self):
        return self.name



