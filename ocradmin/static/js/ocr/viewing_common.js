// Initialisation operations common to both the binarizer
// view and the segmentation view (and probably some others)

var sdviewer = null;
var presetmanager = null;
var pbuilder = null;

function saveState() {
    if (sdviewer) {
        var png = $(sdviewer).data("png");
        var src = $(sdviewer).data("src");
        var outa = $(sdviewer).data("outa");        
        var outb = $(sdviewer).data("outb");        

        if (outa && png) {
            var winprefix = window.location.pathname.replace(/\//g, "");
            $.cookie(winprefix + "_srcpng", png);
            $.cookie(winprefix + "_srcdzi", src);
            $.cookie(winprefix + "_outadzi", outa);
            $.cookie(winprefix + "_outbdzi", outb);
        }
    }
}

function loadState() {
    if (sdviewer) {

        var tid = $("input[name='preload_task_id']").val();
        if (tid)
            pollForResults(tid);

        // if there's stored parameter data, load it after the parameters
        // have initially been set...
        //pbuilder.parametersInitialised = function() {
        //    var pdata = $("input[name='preload_params']").val();
        //    if (pdata) {
        //        //pbuilder.loadData($.parseJSON(pdata));
        //    }
        //};
                

        /*var winprefix = window.location.pathname.replace(/\//g, "");
        var png = $.cookie(winprefix + "_srcpng");
        var src = $.cookie(winprefix + "_srcdzi");
        var outa = $.cookie(winprefix + "_outadzi");
        var outb = $.cookie(winprefix + "_outbdzi");

        if (0 && png && outa) {
            sdviewer.setBufferPath(0, src);
            sdviewer.setBufferPath(1, outa);
            $("#viewerwindow").data("png", png);
            $("#viewerwindow").data("src", src);
            $("#viewerwindow").data("outa", outa);        
            $(".interact_param").attr("disabled", false);

            if (outb) {
                sdviewer.setOutputB(outb);
                $("#viewerwindow").data("outb", outb);        
            } else {
                $("#toggleab").attr("disabled", true);
            }
        }*/
    }
}

// save state on leaving the page... at least try to...
window.onbeforeunload = function(event) {
    saveState();
}



function refreshImage() {
    var params = "src=" + $(sdviewer).data("src") 
        + "&png=" + $(sdviewer).data("png") 
        + "&dst=" + sdviewer.bufferPath(1)
        + "&" + pbuilder.serializedData();

    // have to disable the params AFTER building the param
    // string!
    sdviewer.setWaiting(true);
    //pbuilder.setWaiting(true);

    $.ajax({
        url: window.location.pathname,
        data: params, 
        type: "POST",
        dataType: "json",
        beforeSend: function(data) {
        },
        success: function(data) {
            pollForResults(data[0].task_id);
        },
        error: OCRJS.ajaxErrorHandler,
        complete: function(e) {
        }
    });
}

// convert a list of page-coordinate rectangles into
// a list of seadragon normalized rect objects
function getViewerCoordinateRects(bounds, pagerects) {
    var fw = bounds[2], fh = bounds[3];
    var x, y, w, h, box;
    var outrects = [];
    for (var i in pagerects) {
        box = pagerects[i];
        x = box[0]; y = box[1]; w = box[2]; h = box[3];        
        outrects.push(
            new Seadragon.Rect(x / fw, (y - h) / fw, w / fw, h / fw));
    }
    return outrects;
}


// Process the data completed results data... in this case
// set the viewer source and output paths
function processData(data) {
    if (data.status == "SUCCESS") {
        $(sdviewer).data("png", data.results.png);
        $(sdviewer).data("src", data.results.src);
        if (data.results.dst.search("_b.dzi") != -1) {
            $(sdviewer).data("outb", data.results.dst);
        } else {
            $(sdviewer).data("outa", data.results.dst);
        }
        sdviewer.setBufferPath(2, sdviewer.bufferPath(1));
        sdviewer.setBufferPath(1, data.results.dst);
        sdviewer.setBufferPath(0, data.results.src);
        
        var overlays = {};
        $.each(["lines", "paragraphs", "columns"], function(i, class) {
            if (data.results[class]) {
                overlays[class] = getViewerCoordinateRects(
                    data.results.box, data.results[class]);
                console.log("Adding overlay: " + class);
            }
        });
        sdviewer.setBufferOverlays(sdviewer.bufferOverlays(1), 2);
        sdviewer.setBufferOverlays(overlays, 1);
        console.log(overlays);

        $(".tbbutton").button({disabled: false});
    } else {
        if (data.error)
            alert(data.error);
        else
            alert("Oops.  Task finished with bad status: " + data.status);
    }

    sdviewer.setWaiting(false);
    //pbuilder.setWaiting(false);
} 
            
// keep checking the server for the results of the jobname
// associated with the particular element
function pollForResults(tid) {
    $.ajax({
        url: "/ocr/results/" + tid,
        dataType: "json",
        success: function(data) {
            if (!data || !data.status || data.status == "PENDING") {
                setTimeout(function() {
                    pollForResults(tid);
                }, 500);
            } else {            
                processData(data);
            }
        },
        error: OCRJS.ajaxErrorHandler,
    }); 
}

// process the INITIAL json data that arrives after the files
// have been uploaded but before it has been processed.
function onXHRLoad(event) {
    var xhr = event.target;
    if (!xhr.responseText) {
        return;
    }                
    if (xhr.status != 200) {
        return alert("Error: " + xhr.responseText + "  Status: " + xhr.status);
    } 
    var data = $.parseJSON(xhr.responseText);
    if (data.error) {
        alert("Error: " + data.error + "\n\n" + data.trace);
        $("#dropzone").text("Drop images here...").removeClass("waiting");
        return;
    }

    sdviewer.setWaiting(true);
    $.each(data, function(page, pageresults) {
        pollForResults(pageresults.task_id);
    }); 
};



$(function() {

    // initialise the viewer
    sdviewer = new OCRJS.ImageViewer($("#viewer").get(0), {
        numBuffers: 3,
        log: false,
        dashboard: false,
    });
    sdviewer.setActiveBuffer(1); 

    // build toolbar
    $(".tbbutton").button({});
    $("#output").buttonset();
    $("#zoomin").button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#zoomout").button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });
    $("#centre").button({
        text: false,
        icons: {
            primary: "ui-icon-home",
        }
    });
    $("#fullscreen").button({
        text: false,
        icons: {
            primary: "ui-icon-arrow-4-diag",
        }
    });

    $("#refresh").button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }
    });

    // refresh on compparm enter    
    $(".compparam > input").live("keydown", function(event) {         
        if (event.keyCode == KC_RETURN) {
           refreshImage();            
           return false;
        }
    });

    $("#hl_lines, #hl_paragraphs, #hl_columns").click(function(event) {
        var class = this.id.replace(/hl_/, "");
        $(".viewer_highlight." + class).globalcss(
            "display", $(this).attr("checked") ? "block" : "none");
    });

    // make interactive params disabled at the start
    $(".tbbutton").button({disabled: true});



    // toggle the source and binary images
    $("#togglesrc").click(function(event) {
        var active = sdviewer.activeBuffer();        
        sdviewer.setActiveBuffer(active == 0 ? 1 : 0);        
    });
    $("#toggleab").click(function(event) {
        var active = sdviewer.activeBuffer();
        sdviewer.setActiveBuffer(active == 1 ? 2 : 1);
    });

    // resubmit the form...
    $("#refresh").click(refreshImage);

    $("#output_s").click(function(event) {
        sdviewer.setActiveBuffer(0);
    });

    $("#output_a").click(function(event) {
        sdviewer.setActiveBuffer(1);
    });

    $("#output_b").click(function(event) {
        sdviewer.setActiveBuffer(2);
    });

    $("#zoomin").click(function(event) {
        sdviewer.zoomBy(2);
    });

    $("#zoomout").click(function(event) {
        sdviewer.zoomBy(0.5);
    });

    $("#centre").click(function(event) {
        sdviewer.goHome();
    });

    $("#fullscreen").click(function(event) {
        sdviewer.setFullPage(true);
    });

    // make the viewer resizable
    $("#viewercontainer").resizable({
        resize: function(event, ui) {
            sdviewer.updateSize(
                $(this).width(),
                $(this).height() - $(".widget_header").outerHeight(true)
            );
        },
    });

    // bind 1-2-3 and a-b-s to viewer outputs
    $("#viewer").bind("mouseenter mouseleave", function(mouseevent) {
        if (mouseevent.type == "mouseenter") {
            $(window).bind("keypress.viewer", function(event) {
                if (String.fromCharCode(event.which).toLowerCase().match(/[a]/)) {
                    $("#output_a").click().button("refresh");
                } else if (String.fromCharCode(event.which).toLowerCase().match(/[b]/)) {
                    $("#output_b").click().button("refresh");
                } else if (String.fromCharCode(event.which).toLowerCase().match(/[s]/)) {
                    $("#output_s").click().button("refresh");
                } else if (String.fromCharCode(event.which).toLowerCase().match(/[t]/)) {
                    if ($("#output_s").attr("checked")) {
                        $("#output_a").click().button("refresh");
                    } else {
                        $("#output_s").click().button("refresh");
                    }
                } else if (String.fromCharCode(event.which).toLowerCase().match(/[o]/)) {
                    if ($("#output_a").attr("checked")) {
                        $("#output_b").click().button("refresh");
                    } else {
                        $("#output_a").click().button("refresh");
                    }
                }  
            });
        } else {
            $(window).unbind("keypress.viewer");
        }
    });

    // initialise the uploader...
    var uploader  = new OCRJS.AjaxUploader(
        $("#dropzone").get(0),
        window.location.pathname, 
        { multi: false }
    );
    uploader.addListeners({
        onXHRLoad: onXHRLoad,
        onUploadsStarted: function(event) {
            // close anything that's already open in the viewer
            sdviewer.close();
            //pbuilder.setWaiting(true);
            $("#dropzone").text("Please wait...").addClass("waiting");
            // slurp up the parameters.  Since the params are build 
            // dynamically this has to be done immediately before the
            // upload commences, hence in the onUploadsStarted handler
            uploader.clearParameters();
            $("#optionsform input, #optionsform select").each(function(i, elem) {
                uploader.registerTextParameter(elem);
            });
        },
        onUploadsFinished: function(e) {
            //pbuilder.setWaiting(false);        
            $("#dropzone").text("Drop images here...").removeClass("waiting"); 
        },
    });

    loadState();

});
