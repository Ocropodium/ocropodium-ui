"""
Utility class for displaying node scripts.
"""

import os
import sys
import pydot
import json
import tempfile


def get_node_positions(nodelist):
    """
    Build the pydot graph.
    """
    g = pydot.Dot(margin="0.1")
    for n in nodelist:
        node = pydot.Node(n["name"], width="1", fixedsize="1")
        g.add_node(node)

    for n in nodelist:
        for i in n["inputs"]:
            try:
                src = g.get_node(i)
                if isinstance(src, list):
                    src = src[0]
                dst = g.get_node(n["name"])
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
    for n in nodelist:
        gn = g.get_node(n["name"])
        if isinstance(gn, list):
            gn = gn[0]
        out[n["name"]] = [int(d) \
                for d in gn.get_pos().replace('"', "").split(",")]
    return out
   
if __name__ == "__main__":
    nodes = []
    with open(sys.argv[1], "r") as f:
        nodes = json.load(f)
    print get_node_positions(nodes)

