"""
Utility class for displaying node scripts.
"""

import os
import sys
import pydot
import json
import tempfile


def get_node_positions(nodedict):
    """
    Build the pydot graph.
    """
    g = pydot.Dot(margin="0.1", ranksep="0.7", nodesep="1.5")
    for name, node in nodedict.iteritems():
        n = pydot.Node(name, width="0.5", fixedsize="0.5")
        g.add_node(n)

    for name, node in nodedict.iteritems():
        for i in node["inputs"]:
            try:
                src = g.get_node(i)
                if isinstance(src, list):
                    src = src[0]
                dst = g.get_node(name)
                if isinstance(dst, list):
                    dst = dst[0]
                g.add_edge(pydot.Edge(src, dst))
            except IndexError:
                print "Input %s not found" % i

    with tempfile.NamedTemporaryFile(delete=False, suffix=".dot") as t:
        g.write_dot(t.name)
    g = pydot.graph_from_dot_file(t.name)
    os.unlink(t.name)

    out = {}
    for name, node in nodedict.iteritems():
        gn = g.get_node(name)
        if isinstance(gn, list):
            gn = gn[0]
        out[name] = [int(float(d)) \
                for d in gn.get_pos().replace('"', "").split(",")]
    return out
   
if __name__ == "__main__":
    nodes = {}
    with open(sys.argv[1], "r") as f:
        nodes = json.load(f)
    print get_node_positions(nodes)

