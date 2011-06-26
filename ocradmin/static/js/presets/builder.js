//
// Handle drag and drop page conversions
//

// only in global scope for dubugging purposes
var uploader = null;
var formatter = null;
var nodetree = null;
var sdviewer = null;
var hocrviewer = null;
var reshandler = null;
var presetmanager = null;
var guimanager = null;

function saveState() {
    presetmanager.saveState();
    nodetree.saveState();
}


function loadState() {
    presetmanager.loadState();
    nodetree.loadState();
}

$(function() {

    // script builder buttons
    $("#stop_refresh").button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }        
    });
    $("#focus_script").button({
        text: false,
        icons: {
            primary: "ui-icon-home",
        }        
    });
    $("#layout_nodes").button({
        text: false,
        icons: {
            primary: "ui-icon-grip-dotted-vertical",
        }        
    });
    $("#clear_cache").button({
        text: false,
        icons: {
            primary: "ui-icon-suitcase",
        }        
    });

    // viewer toolsbar
    // style toolbar
    $(".tbbutton").button({
        disabled: false,
    });
    $("#format").buttonset();
    $("#hocr_zoomin").click(function(event) {
        hocrviewer.increaseFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#hocr_zoomout").click(function(event) {
        hocrviewer.reduceFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });
    $("#format_block").click(function(event) {
        formatter.blockLayout(hocrviewer.container());
    });
    $("#format_line").click(function(event) {
        formatter.lineLayout(hocrviewer.container());
    });
    $("#format_column").click(function(event) {
        formatter.columnLayout(hocrviewer.container());
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

    $("#refresh").click(function(event) {
        var active = sdviewer.activeBuffer();
        sdviewer.setBufferPath(active, sdviewer.bufferPath(active));    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }
    });

    $("#focus_script").click(function(event) {
        nodetree.centreTree();
        event.preventDefault();
        event.stopPropagation();
    });
    $("#layout_nodes").click(function(event) {
        nodetree.layoutNodes();
        event.preventDefault();
        event.stopPropagation();
    });
    $("#clear_cache").click(function(event) {
        resultcache = {};
        event.preventDefault();
        event.stopPropagation();
    });

    // initialise the uploader...
    uploader  = new OCRJS.AjaxUploader(
        null,
        "/presets/upload/", 
        { multi: false, errorhandler: OCRJS.ajaxErrorHandler, }
    );
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

    $("#stop_refresh").click(function() {
        if (reshandler.isPending()) {
            reshandler.abort();
        } else {
            nodetree.scriptChanged("Refresh");
        }
        event.stopPropagation();
        event.preventDefault();
    });        

    $("#optionsform").submit(function() {
        nodetree.scriptChanged();
        event.stopPropagation();
        event.preventDefault();
    });        

    var resultcache = {};
    function handleResult(nodename, data, cached) {
        console.log("Data:", data);
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
        } else if (data.result.type == "hocr") {
            hocrviewer.setData(data.result.data);
            formatter.blockLayout(hocrviewer.container());
            $("#viewertabs").tabs("select", 1);
        } else if (data.result.type == "text") {
            textviewer.setData(data.result.data);
            $("#viewertabs").tabs("select", 2);
        } else {
            throw "Unknown result type: " + data.result.type;
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
    hocrviewer = new OCRJS.HocrViewer($("#hocrviewer_1").get(0));
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
        ready: function() {
            // load state stored from last time
            loadState();
        },                   
    });

    //var iconstates = ["ui-icon-arrowrefresh-1-w", "ui-icon-arrowrefresh-1-n",
    //        "ui-icon-arrowrefresh-1-e", "ui-icon-arrowrefresh-1-s"];
    //var refindex = 0;
    //var reftimer = null;
    //function showPending() {
    //    clearTimeout(reftimer);
    //    reftimer = setTimeout(function() {            
    //        $("#stop_refresh").button("option", "icons", {
    //            primary: iconstates[refindex],
    //        });
    //        refindex++;
    //        if (refindex >= iconstates.length)
    //            refindex = 0;
    //        showPending(); 
    //    }, 100);
    //}    

    reshandler.addListeners({
        resultPending: function() {
            $("#stop_refresh").button({
                text: false,
                icons: {
                    primary: "ui-icon-cancel",    
                }
            });
            //showPending();
            nodetree.clearErrors();
        },
        validationError: function(node, error) {
            //clearTimeout(reftimer);
            $("#stop_refresh").button({
                text: false,
                icons: {
                    primary: "ui-icon-refresh",    
                }
            });
            nodetree.setNodeErrored(node, error);
            // clear the client-size cache
            resultcache = {};
        },
        resultDone: function(node, data) {                                
            //clearTimeout(reftimer);
            $("#stop_refresh").button({
                text: false,
                icons: {
                    primary: "ui-icon-refresh",    
                }
            });
            if (data.status != "ABORT" && data.status != "FAILURE")
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

