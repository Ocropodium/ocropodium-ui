
$(document).ready(function(){

    module("OCR Page Object Test");

    test("Initialisation test", function() {
        expect(1);
        
        var testdiv = $("<div></div>").attr("id", "test_div");
        $("body").append(testdiv);
        same($("#test_div").attr("id"), testdiv.attr("id"),
            "Document insertion test failed: expected " + testdiv.attr("id"),
            $("test_div").attr("id"));

    });

    

    test("Test Nodetree", function() {
        expect(7);

        var parent = $("<div></div>")
            .attr("id", "nodetree_canvas")
            .appendTo("body");
        var cmdstack = new OcrJs.UndoStack(this);
        var nodetree = new OcrJs.Nodetree.Tree(parent, cmdstack);


        // Initialise nodetree!
        stop();
        $.getJSON("/presets/query/", function(data) {
            nodetree.startup(data);
        });

        nodetree.addListeners({
            ready: function() {
                start();
                equal(!nodetree.hasNodes(), true,
                    "Expected nodetree to be initially empty");

                // create a test node
                var testtype = "ocropus.GrayFileIn";
                var name = nodetree.newNodeName(testtype);
                nodetree.cmdCreateNode(name, testtype, {x: 100, y: 100});
                equal(nodetree.nodeCount(), 1,
                    "Expected number of nodes in the tree to be");

                // test undoing the action
                cmdstack.undo();
                equal(nodetree.nodeCount(), 0,
                    "After undo, expected number of nodes in the tree to be");

                // test redoing the action
                cmdstack.redo();
                equal(nodetree.nodeCount(), 1,
                    "After redo, expected number of nodes in the tree to be");

                // create a second node
                var testtype2 = "util.FileOut";
                var name2 = nodetree.newNodeName(testtype2);
                nodetree.cmdCreateNode(name2, testtype2, {x: 100, y: 200});
                equal(nodetree.nodeCount(), 2,
                        "Created another node, expected number of nodes in the tree to be");

                // connect them up
                nodetree.cmdConnectPlugs(
                        nodetree.getNode(name).output(),
                        nodetree.getNode(name2).input(0)
                );
                equal(nodetree.getNode(name2).input(0).isAttached(), true,
                        "After connecting plugs, expected input isAttached to be");

                // select all nodes
                nodetree.selectAll();
                equal(nodetree.selectedNodeCount(), nodetree.nodeCount(),
                        "SelectAll, expected number of selected nodes to be");
            },
        });
    });
});
