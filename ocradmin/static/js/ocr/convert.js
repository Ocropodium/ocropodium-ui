//
// Handle drag and drop page conversions
//

// only in global scope for dubugging purposes
var uploader = null;
var formatter = null;
var nodetree = null;
var sdviewer = null;
var textviewer = null;
var reshandler = null;
var presetmanager = null;
var guimanager = null;

function saveState() {
    nodetree.saveState();
}


function loadState() {

}

$(function() {

    // script builder buttons
    $("#abort").button({
        text: false,
        icons: {
            primary: "ui-icon-cancel",
        }        
    });
    $("#rerun_script").button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }        
    });
    $("#open_script_button").button({
        text: true,
        icons: {
            primary: "ui-icon-folder-open",
            secondary: "ui-icon-carat-1-s",
        }
    });
    $("#save_script_button").button({
        text: false,
        icons: {
            primary: "ui-icon-disk",
        }
    });
    $("#download_script_button").button({
        text: false,
        icons: {
            primary: "ui-icon-document",
        }        
    });

    // viewer toolsbar
    // style toolbar
    $(".tbbutton").button({
        disabled: false,
    });
    $("#format").buttonset();
    $("#text_zoomin").click(function(event) {
        textviewer.increaseFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#text_zoomout").click(function(event) {
        textviewer.reduceFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });
    $("#format_block").click(function(event) {
        formatter.blockLayout(textviewer.container());
    });
    $("#format_line").click(function(event) {
        formatter.lineLayout(textviewer.container());
    });
    $("#format_column").click(function(event) {
        formatter.columnLayout(textviewer.container());
    });

    $("#image_zoomin").click(function(event) {
        sdviewer.zoomBy(2);        
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#image_zoomout").click(function(event) {
        sdviewer.zoomBy(0.5);    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });
    $("#centre").click(function(event) {
        sdviewer.goHome();    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-home",
        }
    });
    $("#fullscreen").click(function(event) {
        sdviewer.setFullPage(true);    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-arrow-4-diag",
        }
    });

    $("#refresh").click(function(event) {
        var active = sdviewer.activeBuffer();
        sdviewer.setBufferPath(active, sdviewer.bufferPath(active));    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }
    });


    // initialise the uploader...
    uploader  = new OCRJS.AjaxUploader(
        null,
        "/plugins/upload/", 
        { multi: false, errorhandler: OCRJS.ajaxErrorHandler, }
    );
    // load state stored from last time
    loadState();
    
    // save state on leaving the page... at least try to...
    window.onbeforeunload = function(event) {
        try {
            saveState();
        } catch (msg) {
            alert(msg);
        }
    }

    $(".nodefilein").live("change", function(event) {
        console.log("Change:", $(this).val());
    });

    $("#viewertabs").tabs({
        select: function(event, ui) {
            // ensure we refresh the buffer when switching
            // back to an image tab, otherwise the viewer
            // loses its images...
            sdviewer.setBufferPath(sdviewer.activeBuffer(),
                sdviewer.activeBufferPath());
        },
    });

    $("#optionsform").submit(function() {
        nodetree.scriptChanged();
        event.stopPropagation();
        event.preventDefault();
    });        

    var resultcache = {};
    function handleResult(nodename, data, cached) {
        if (data.result.type == "error") {
            console.log("NODE ERROR: ", data.result.node, data.result.error);
            nodetree.setNodeErrored(data.result.node, data.result.error);
            return;
        }

        // otherwise cache the result and handle it
        if (!cached) {
            var node = nodetree.getNode(nodename);
            if (node) {
                var hash = hex_md5(bencode(node.hashValue()));
                resultcache[hash] = data;
            }
        }

        if (data.result.type == "image" || data.result.type == "pseg") {
            // this magic hides the buffer loading transition by putting the
            // new data in the back buffer and switching them after a delay
            // TODO: Find if we can subscript to an event to tell us exactly
            // when it's safe to switch.  ATM just using a 200ms delay.
            var active = sdviewer.activeBuffer();
            sdviewer.setBufferPath(active^1, data.result.dzi);
            setTimeout(function() {
                sdviewer.setActiveBuffer(active^1);
                guimanager.refreshGui();
            }, 150);
            
            var overlays = {};
            if (data.result.type == "pseg") {
                console.log("Result:", data.result);
                var overlays = {};
                $.each(["lines", "paragraphs", "columns"], function(i, class) {
                    if (data.result[class]) {
                        overlays[class] = data.result[class];
                    }
                });
            }
            sdviewer.setBufferOverlays(overlays, 0);
            $("#viewertabs").tabs("select", 0);
        } else if (data.result.type == "text") {
            textviewer.setData(data.result.data);
            formatter.blockLayout($(".textcontainer"));
            $("#viewertabs").tabs("select", 1);
        }
    }

    function runScript() {
        var nodename = nodetree.getEvalNode();
        var node = nodetree.getNode(nodename);
        if (node) {
            var hash = hex_md5(bencode(node.hashValue()));
            console.log("Hash for node", node.name, hash);
            if (resultcache[hash]) {
                console.log("Found cached result for:", nodename);
                handleResult(nodename, resultcache[hash], true);
            } else
                reshandler.runScript(nodename, nodetree.buildScript());
        }
    }    


    // Initialise objects
    sdviewer = new OCRJS.ImageViewer($("#imageviewer_1").get(0), {
        numBuffers: 2,
        dashboard: false,
    });
    guimanager = new OCRJS.Nodetree.GuiManager(sdviewer);    
    textviewer = new OCRJS.TextViewer($("#textviewer_1").get(0));
    reshandler = new OCRJS.ResultHandler();
    formatter = new OCRJS.LineFormatter();
    nodetree = new OCRJS.Nodetree.NodeTree($("#node_canvas"));
    presetmanager = new OCRJS.PresetManager($("#script_toolbar").get(0), nodetree);

    // Set up events
    nodetree.addListeners({
        scriptChanged: function(what) {
            console.log("Script changed:", what);
            presetmanager.checkForChanges();
            runScript();
        },
        nodeFocussed: function(node) {
            if (!node)
                guimanager.tearDownGui();
            else {
                if (sdviewer.activeViewer()) {
                    console.log("Setting GUI for", node.name);
                    guimanager.setupGui(node);
                }
            }
        },                          
        registerUploader: function(name, elem) {
            uploader.removeListeners("onXHRLoad.setfilepath");
            uploader.setTarget(elem);
            // FIXME: No error handling
            uploader.addListener("onXHRLoad.setfilepath", function(data) {
                nodetree.setFileInPath(name, JSON.parse(data.target.response).file);
            });
        },                              
    });    

    reshandler.addListeners({
        resultPending: function() {
            nodetree.clearErrors();
        },
        validationError: function(node, error) {
            nodetree.setNodeErrored(node, error);
            // clear the client-size cache
            resultcache = {};
        },
        resultDone: function(node, data) {
           handleResult(node, data, false);
        }        
    });

    var hsplit = $("#sidebar").layout({
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0, 
        },
        south: {
            size: 200,
            onresize_end: function() {
                setTimeout(function() {
                    nodetree.resetSize();
                });
            },
            onclose_end: function() {
                setTimeout(function() {
                    nodetree.resetSize();
                });
            },
        },                   


    });

    vsplit.options.east.onresize_end = function() {
        setTimeout(function() {
            nodetree.resetSize();
        });
    };

    $(window).resize();

    // Initialise nodetree!    
    nodetree.init();

    // the run script on first load
    runScript();    
});

