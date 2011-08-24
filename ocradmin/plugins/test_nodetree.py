#!/usr/bin/python

import os
import glob
import sys
import json
sys.path.append(os.path.abspath(".."))
os.environ['DJANGO_SETTINGS_MODULE'] = 'ocradmin.settings'

sys.path.insert(0, "lib")

from nodetree import script
from nodetree.manager import ModuleManager

def run(nodelist, outpath):
    manager = ModuleManager()
    manager.register_paths(glob.glob("plugins/*_nodes.py"), root="ocradmin")

    s = script.Script(nodelist, manager=manager)
    term = s.get_terminals()[0]
    print "Rendering to %s" % outpath
    os.environ["NODETREE_WRITE_FILEOUT"] = "1"
    out = manager.get_new_node("Utils::FileOut", label="Output",
            params=[("path", os.path.abspath(outpath))])
    out.set_input(0, term)
    out.eval()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print "Usage: %s <script> <output>" % sys.argv[0]
        sys.exit(1)

    nodes = None
    with open(sys.argv[1], "r") as f:
        nodes = json.load(f)

    if nodes is None:
        print "No nodes found in script"
        sys.exit(1)

    run(nodes, sys.argv[2])

