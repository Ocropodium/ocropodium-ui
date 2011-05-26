"""
Base class for OCR nodes.
"""

import logging
FORMAT = '%(levelname)-5s %(name)s: %(message)s'
logging.basicConfig(format=FORMAT)
LOGGER = logging.getLogger("Node")
LOGGER.setLevel(logging.DEBUG)

import cache

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
    name = "Base::None"
    description = "Base node"
    arity = 1
    stage = "general"
    _parameters = [

    ]

    def __init__(self, label=None, abort_func=None, 
                cacher=None,
                progress_func=None, logger=None):
        """
        Initialise a node.
        """
        self.abort_func = abort_func if abort_func is not None \
                else noop_abort_func
        self.logger = logger if logger is not None \
                else LOGGER
        self.progress_func = progress_func if progress_func is not None \
                else noop_progress_func
        self._cacher = cacher if cacher is not None \
                else cache.BasicCacher(logger=self.logger)
        self._params = {}
        self.label = label
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
        self._cacher.clear_cache()

    def set_cache(self, cache):
        """
        Set the cache on a node, preventing it
        from eval'ing its inputs.
        """
        self._cacher.set_cache(self, cache)

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

    def hash_value(self):
        """
        Get a representation of this
        node's current state.  This is a data
        structure the node type, it's
        parameters, and it's children's hash_values.
        """
        def makesafe(val):
            if isinstance(val, unicode):
                return val.encode()
            elif isinstance(val, float):
                return str(val)
            return val

        return dict(
            name=self.name.encode(),
            params=[[makesafe(v) for v in p] for p \
                    in self._params.iteritems()],
            children=[n.hash_value() for n in self._inputs \
                    if n is not None]
        )

    def eval(self):
        """
        Eval the node.
        """
        self.logger.debug("Evaluating '%s' Node", self)
        if self._cacher.has_cache(self):
            self.logger.debug("%s returning cached input", self)
            return self._cacher.get_cache(self)
        self.validate()
        for p, v in self._params.iteritems():
            self.logger.debug("Set Param %s.%s -> %s",
                    self, p, v)
            self._set_p(p, v)            
        data = self._eval()
        self._cacher.set_cache(self, data)
        return data

    def __repr__(self):
        return "<Node: %s" % self.name

    def __str__(self):
        return self.name



