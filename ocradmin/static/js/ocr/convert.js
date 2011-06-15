//
// Handle drag and drop page conversions
//

// should probably be moved to app-global scope
const MINFONTSIZE = 6;
const MAXFONTSIZE = 40;

// only in global scope for dubugging purposes
var uploader = null;
var formatter = null;
var nodetree = null;
var sdviewer = null;
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
    $("#open_script").button({
        text: false,
        icons: {
            primary: "ui-icon-folder-open",
        }
    });
    $("#save_script").button({
        text: false,
        icons: {
            primary: "ui-icon-disk",
        }
    });
    $("#download_script").button({
        text: false,
        icons: {
            primary: "ui-icon-document",
        }        
    });

    presetmanager = new OCRJS.PresetManager(
            document.getElementById("script_toolbar"));
    presetmanager.addListeners({
        saveDialogOpen: function() {
            nodetree.setDisabled(true);
        },
        saveDialogClose: function() {
            nodetree.setDisabled(false);
        },
    });

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
            setTimeout(function() {
                sdviewer.drawBufferOverlays();
            }, 100);
        },
    });

    //presetmanager = new OCRJS.PresetManager("#script_toolbar");
    //presetmanager.getPresetData = function() {
    //    return JSON.stringify(nodetree.buildScript(), false, '\t');
    //};
    //presetmanager.addListeners({
    //    onPresetLoadData: function(data) {
    //        nodetree.clearScript();
    //        nodetree.loadScript(JSON.parse(data));
    //    },
    //    onPresetClear: function(data) {
    //        nodetree.clearScript();
    //    },
    //});
    
    $("#save_script").click(function(event) {
        presetmanager.showNewPresetDialog(
                JSON.stringify(nodetree.buildScript(), null, "\t"));
    });        
    
    $("#download_script").click(function(event) {
        var json = JSON.stringify(nodetree.buildScript(), false, '\t');
        $("#fetch_script_data").val(json);
        $("#fetch_script").submit();
        event.stopPropagation();
        event.preventDefault();    
    });
    
    $("#select_script").change(function(event) {
        if ($(this).val() < 1) {
            nodetree.clearScript();
        } else {
            $.ajax({
                url: "/presets/data/" + $(this).val(),
                error: OCRJS.ajaxErrorHandler,
                success: function(data) {
                    nodetree.clearScript();
                    nodetree.loadScript(JSON.parse(data));
                },
            });
        }
        event.stopPropagation();
        event.preventDefault();    
    });

    $("#test_file_container").selectable({

    });        
    // initialise the uploader...
    uploader  = new OCRJS.AjaxUploader(
        null,
        "/plugins/upload/", 
        { multi: false, errorhandler: OCRJS.ajaxErrorHandler, }
    );
    uploader.addListener("onXHRLoad", function(data) {
        var filepath = JSON.parse(data.target.response).file;
        var filename = filepath.split("/").splice(-1, 1)[0];
        var elem = $("<li></li>");
        console.log("filename", filename);
        elem
            .data(filepath)
            .text(filename);
        $("#test_file_container").append(elem).selectable("refresh");
    });
    setTimeout(function() {
        uploader.setTarget($("#test_file_container").get(0));
    }, 100);

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
            }, 200);
            
            if (data.result.type == "pseg") {
                var overlays = {};
                $.each(["lines", "paragraphs", "columns"], function(i, class) {
                    if (data.result.data[class]) {
                        overlays[class] = sdviewer.getViewerCoordinateRects(
                            data.result.data.box, data.result.data[class]);
                        console.log("Adding overlay: " + class);
                    }
                });
                sdviewer.setBufferOverlays(sdviewer.bufferOverlays(0), 1);
                sdviewer.setBufferOverlays(overlays, 0);
            }
            $("#viewertabs").tabs("select", 0);
        } else if (data.result.type == "text") {
            textviewer.setData(data.result.data);
            formatter.blockLayout($(".textcontainer"));
            $("#viewertabs").tabs("select", 1);
        }
    }        

    sdviewer = new OCRJS.ImageViewer($(".imageviewer").get(0), {
        numBuffers: 2,        
    });
    guimanager = new OCRJS.Nodetree.GuiManager(sdviewer);    

    textviewer = new OCRJS.TextViewer($(".textviewer").get(0));
    reshandler = new OCRJS.ResultHandler();
    formatter = new OCRJS.LineFormatter();
    nodetree = new OCRJS.Nodetree.NodeTree(document.getElementById("node_canvas"));

    nodetree.addListener("scriptChanged", function() {
        var nodename = nodetree.getEvalNode();
        var node = nodetree.getNode(nodename);
        if (node) {
            var hash = hex_md5(bencode(node.hashValue()));
            if (resultcache[hash]) {
                console.log("Found cached result for:", nodename);
                handleResult(nodename, resultcache[hash], true);
            } else
                reshandler.runScript(nodename, nodetree.buildScript());
        }
    });
    //nodetree.addListener("registerUploader", function(name, elem) {

    //    uploader.removeListeners("onXHRLoad.setfilepath");
    //    uploader.setTarget(elem);
    //    // FIXME: No error handling
    //    uploader.addListener("onXHRLoad.setfilepath", function(data) {
    //        nodetree.setFileInPath(name, JSON.parse(data.target.response).file);
    //    });
    //});
    nodetree.addListener("nodeViewing", function(node) {
        if (!node)
            guimanager.tearDownGui();
        else
            guimanager.setupGui(node);
    });

    reshandler.addListener("resultPending", function() {
        nodetree.clearErrors();
    });        
    reshandler.addListener("validationError", function(node, error) {
        nodetree.setNodeErrored(node, error);
    });        
    reshandler.addListener("resultDone", function(node, data) {
        handleResult(node, data, false);
    }); 
    nodetree.init();

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
});

