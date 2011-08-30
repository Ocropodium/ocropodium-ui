"""
Nodetree test suite.
"""

import unittest

import cache
import manager
import node
import script

import test_nodes


class TestManager(unittest.TestCase):
    def setUp(self):
        pass

    def test_register_module(self):
        m = manager.ModuleManager()
        m.register_module("test_nodes")
        self.assertGreater(len(m.get_nodes()), 0)        


class TestScript(unittest.TestCase):
    def setUp(self):
        self.manager = manager.ModuleManager()
        self.manager.register_module("test_nodes")

    def test_create_script(self):
        s = script.Script({}, manager=self.manager)
        self.assertEqual(len(s.serialize()), 0)

    def test_script_add_node(self):
        s = script.Script({}, manager=self.manager)
        n1 = s.add_node("Test::Number", "Val1", (("num", 2),))
        self.assertEqual(len(s.serialize()), 1)

        nget = s.get_node("Val1")
        self.assertEqual(nget, n1)




class NodeTests(unittest.TestCase):
    def setUp(self):
        self.script = self._buildTestScript()

    def test_add(self):
        t = self.script.get_terminals()[0]
        self.assertEqual(t.label, "Add")
        self.assertEqual(t.eval(), 5)

        op = self.script.get_node("Add")
        op.set_param("operator", "*")
        print op._params
        print op._eval()
        self.assertEqual(op._params.get("operator"), "*")
        self.assertEqual(op.eval(), 6)

    def _buildTestScript(self):
        m = manager.ModuleManager()
        m.register_module("test_nodes")

        s = script.Script({}, manager=m)
        n1 = s.add_node("Test::Number", "Val1", (("num", 2),))
        n2 = s.add_node("Test::Number", "Val2", (("num", 3),))
        n3 = s.add_node("Test::Arithmetic", "Add", (("operator", "+"),))
        n3.set_input(0, n1)
        n3.set_input(1, n2)
        return s


if __name__ == '__main__':
    unittest.main()

