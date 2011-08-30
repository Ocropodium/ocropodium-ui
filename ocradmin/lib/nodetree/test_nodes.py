"""
Nodetree test nodes.
"""

import types

import node
import manager

NAME = "Test"

class NumberNode(node.Node):
    """A number constant."""
    name = "%s::Number" % NAME
    arity = 0
    intypes = []
    outtype = types.IntType
    _parameters = [
            dict(name="num", value=0),
    ]

    def _eval(self):
        return self._params.get("num")


class ArithmeticNode(node.Node):
    """Operate on two numbers"""
    name = "%s::Arithmetic" % NAME
    description = "Operate on two numbers"
    arity = 2
    intypes = [types.IntType, types.IntType]
    outtype = types.IntType
    _parameters = [
        dict(name="operator", value="+", choices=[
            "+", "-", "*", "/",    
        ]),
    ]

    def _eval(self):
        op = self._params.get("operator")
        lhs = self.eval_input(0)
        rhs = self.eval_input(1)
        if op == "+":
            return lhs + rhs
        elif op == "-":
            return lhs - rhs
        elif op == "*":
            return lhs * rhs
        elif op == "/":
            return lhs / rhs


class Manager(manager.StandardManager):
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        g = globals()
        if g.get(name + "Node"):            
            return g.get(name + "Node")(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())



