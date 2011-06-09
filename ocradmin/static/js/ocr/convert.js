//
// Handle drag and drop page conversions
//

// should probably be moved to app-global scope
const MINFONTSIZE = 6;
const MAXFONTSIZE = 40;

// only in global scope for dubugging purposes
var uploader = null;
var formatter = null;
var pbuilder = null;
var sdviewer = null;
var reshandler = null;
var presetmanager = null;

function saveState() {
    pbuilder.saveState();
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
            pbuilder.setDisabled(true);
        },
        saveDialogClose: function() {
            pbuilder.setDisabled(false);
        },
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
            setTimeout(function() {
                sdviewer.drawBufferOverlays();
            }, 100);
        },
    });

    //presetmanager = new OCRJS.PresetManager("#script_toolbar");
    //presetmanager.getPresetData = function() {
    //    return JSON.stringify(pbuilder.buildScript(), false, '\t');
    //};
    //presetmanager.addListeners({
    //    onPresetLoadData: function(data) {
    //        pbuilder.clearScript();
    //        pbuilder.loadScript(JSON.parse(data));
    //    },
    //    onPresetClear: function(data) {
    //        pbuilder.clearScript();
    //    },
    //});
    
    $("#download_script").click(function(event) {
        var json = JSON.stringify(pbuilder.buildScript(), false, '\t');
        $("#fetch_script_data").val(json);
        $("#fetch_script").submit();
        event.stopPropagation();
        event.preventDefault();    
    });
    
    $("#select_script").change(function(event) {
        if ($(this).val() < 1) {
            pbuilder.clearScript();
        } else {
            $.ajax({
                url: "/ocrpresets/data/" + $(this).val(),
                error: OCRJS.ajaxErrorHandler,
                success: function(data) {
                    pbuilder.clearScript();
                    pbuilder.loadScript(JSON.parse(data));
                },
            });
        }
        event.stopPropagation();
        event.preventDefault();    
    });

    sdviewer = new OCRJS.ImageViewer($(".imageviewer").get(0), {
        numBuffers: 2,        
    });
    textviewer = new OCRJS.TextViewer($(".textviewer").get(0));
    reshandler = new OCRJS.ResultHandler();
    formatter = new OCRJS.LineFormatter();
    pbuilder = new OCRJS.Nodetree.NodeTree(document.getElementById("node_canvas"));
    pbuilder.addListener("resultPending", function(node, pendingdata) {
        reshandler.watchNode(node, pendingdata);
    });
    pbuilder.addListener("registerUploader", function(name, elem) {

        uploader.removeListeners("onXHRLoad.setfilepath");
        uploader.setTarget(elem);
        // FIXME: No error handling
        uploader.addListener("onXHRLoad.setfilepath", function(data) {
            pbuilder.setFileInPath(name, JSON.parse(data.target.response).file);
        });
    });
    reshandler.addListener("resultDone", function(node, data) {
        if (data.result.type == "error") {
            console.log("NODE ERROR: ", data.result.node, data.result.error);
            pbuilder.setNodeErrored(data.result.node, data.result.error);
            return;
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
    }); 
    pbuilder.init();

    var bsplit = $("body").layout({
        //applyDefaultStyles: true,
        center: {
            resizable: false,
            closable: false, 
        },
    });

    var vsplit = $("#vsplitter").layout({
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0, 
        },
        east: {
            size: 400,
            onresize_end: function() {
                pbuilder.resetSize();
            },
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
        },                   


    });

    $(window).resize();
});

