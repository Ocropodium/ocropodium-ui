
var nodetree, cmdstack;

$(document).ready(function(){  

    function init(parent) {
        cmdstack = new OCRJS.UndoStack(this); 
        nodetree = new OCRJS.Nodetree.Tree(parent, cmdstack);
    }        


    module("OCR Page Object Test");

    test("Initialisation test", function() {
        expect(1);  
        
        var testdiv = $("<div></div>").attr("id", "test_div");
        $("body").append(testdiv);
        same($("#test_div").attr("id"), testdiv.attr("id"), 
            "Document insertion test failed: expected " + testdiv.attr("id"),
            $("test_div").attr("id"));

    });

    

    test("Nodetree Initialisation", function() {  
        expect(2);  

        var parent = $("<div></div>")
            .attr("id", "nodetree_canvas")
            .appendTo("body");

        equal(nodetree, undefined,  
            "Expected nodetree to be initially undefined"); 

        init(parent.get(0));        

        notEqual(nodetree, undefined,  
            "Expected nodetree to be defined after initialisation"); 
    });


    test("Nodetree Create Node", function() {
        expect(7);

        var parent = $("<div></div>")
            .attr("id", "nodetree_canvas")
            .appendTo("body");
        init(parent.get(0));

        stop();

        nodetree.addListeners({
            ready: function() {
                equal(!nodetree.hasNodes(), true,
                    "Expected nodetree to be initially empty");

                // create a test node
                var testtype = "Ocropus::GrayFileIn";
                var name = nodetree.newNodeName(testtype);
                nodetree.cmdCreateNode(name, testtype, {x: 100, y: 100});
                equal(nodetree.nodeCount(), 1,
                    "Expected one node to exist in the tree");

                // test undoing the action
                cmdstack.undo();
                equal(nodetree.nodeCount(), 0,
                    "Expected undoing action to remove created node.");

                // test redoing the action
                cmdstack.redo();
                equal(nodetree.nodeCount(), 1,
                    "Expected redoing action to place node back in tree.");

                // create a second node
                var testtype2 = "Utils::FileOut";
                var name2 = nodetree.newNodeName(testtype2);          
                nodetree.cmdCreateNode(name2, testtype2, {x: 100, y: 200});
                equal(nodetree.nodeCount(), 2,
                        "Expected 2 nodes to now exist in the tree.");

                // connect them up
                nodetree.cmdConnectPlugs(
                        nodetree.getNode(name).output(),
                        nodetree.getNode(name2).input(0)
                );
                equal(nodetree.getNode(name2).input(0).isAttached(), true,
                        "Expected node 1 output to be attached.");

                // select all nodes
                nodetree.selectAll();
                equal(nodetree.selectedNodeCount(), nodetree.nodeCount(),
                        "Expected all nodes to be selected");

            },
        });            

        // Initialise nodetree!    
        $.getJSON("/presets/query/", function(data) {
            start();
            nodetree.init(data);
        });
    });        
});  
