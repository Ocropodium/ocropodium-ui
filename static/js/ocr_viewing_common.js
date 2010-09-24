// Initialisation operations common to both the binarizer
// view and the segmentation view (and probably some others)

var sdviewer = null;
var presetmanager = null;
var pbuilder = null;

function saveState() {
    if (sdviewer) {
        var png = $("#viewerwindow").data("png");
        var src = $("#viewerwindow").data("src");
        var outa = $("#viewerwindow").data("outa");        
        var outb = $("#viewerwindow").data("outb");        

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
        var winprefix = window.location.pathname.replace(/\//g, "");
        var png = $.cookie(winprefix + "_srcpng");
        var src = $.cookie(winprefix + "_srcdzi");
        var outa = $.cookie(winprefix + "_outadzi");
        var outb = $.cookie(winprefix + "_outbdzi");

       /* if (png && outa) {
            sdviewer.setSource(src);
            sdviewer.setOutputA(outa);
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
    var params = "src=" + $("#viewerwindow").data("src") 
        + "&png=" + $("#viewerwindow").data("png") 
        + "&dst=" + sdviewer.activeOutputPath()
        + "&" + pbuilder.serializedData();

    // have to disable the params AFTER building the param
    // string!
    sdviewer.setWaiting(true);
    pbuilder.setWaiting(true);

    $.ajax({
        url: window.location.pathname,
        data: params, 
        type: "POST",
        dataType: "json",
        beforeSend: function(data) {
        },
        success: function(data) {
            $("#viewerwindow").data("jobname", data[0].job_name);
            pollForResults($("#viewerwindow"));
        },
        error: function(xhr, errorResponse, errorThrown) {
            alert("XHR failed: " + errorResponse);
        },
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
function processData(element, data) {
    if (!data || !data.status || data.status == "PENDING") {
        setTimeout(function() {
            pollForResults(element);
        }, 500);
    } else if (data.error) {
        sdviewer.setWaiting(true);
        element
            .addClass("error")
            .html("<h4>Error: " + data.error + "</h4>")
            .append(
                $("<div></div>").addClass("traceback")
                    .append("<pre>" + data.trace + "</pre>")                                
            );                            
    } else if (data.status == "SUCCESS") {
        element.data("png", data.results.png);
        element.data("src", data.results.src);
        if (data.results.dst.search("_b.dzi") != -1) {
            element.data("outb", data.results.dst);
        } else {
            element.data("outa", data.results.dst);
        }
        sdviewer.setBufferPath(2, sdviewer.bufferPath(1));
        sdviewer.setBufferPath(1, data.results.dst);
        sdviewer.setBufferPath(0, data.results.src);
        sdviewer.setWaiting(false);
        pbuilder.setWaiting(false);
        
        var overlays = {};
        $.each(["lines", "paragraphs", "columns"], function(i, class) {
            if (data.results[class]) {
                overlays[class] = getViewerCoordinateRects(
                    data.results.box, data.results[class]);
            }
        });
        sdviewer.setBufferOverlays(sdviewer.bufferOverlays(1), 2);
        sdviewer.setBufferOverlays(overlays, 1);

        $(".tbbutton").button({disabled: false});
    } else {
        alert("Oops.  Task finished with bad status: " + data.status);
    }
} 
            
// keep checking the server for the results of the jobname
// associated with the particular element
function pollForResults(element) {
    var jobname = element.data("jobname");
    $.ajax({
        url: "/ocr/results/" + jobname,
        dataType: "json",
        success: function(data) {
            processData(element, data);    
        },
        error: function(xhr, statusText, errorThrown) {
            var msg = "Http Error: " + statusText;
            if (errorThrown) {
                msg += "\n\n" + errorThrown;
            }
            alert(msg);
        }
    }); 
}

// process the INITIAL json data that arrives after the files
// have been uploaded but before it has been processed.
function onXHRLoad(event_or_response) {
    if (event_or_response.target != null) {
        var xhr = event_or_response.target;
        if (!xhr.responseText) {
            return;
        }                
        if (xhr.status != 200) {
            return alert("Error: " + xhr.responseText + "  Status: " + xhr.status);
        }        
        data = $.parseJSON(xhr.responseText);
    } else {
        // then it must be a single upload...
        data = event_or_response;
    }
    if (data.error) {
        alert("Error: " + data.error + "\n\n" + data.trace);
        $("#dropzone").text("Drop images here...").removeClass("waiting");
        return;
    }

    $.each(data, function(page, pageresults) {
        var pagename = pageresults.job_name.split("::")[0].replace(/\.[^\.]+$/, "");
        //sdviewer.setTitle(pagename);
        sdviewer.setWaiting(true);
        $("#viewer")
            .data("jobname", pageresults.job_name);
        pollForResults($("#viewer"));
    }); 
};


function doIframeUpload(elem) {
    if ($(elem).val() == "") {
        return false;
    }

    // get the extra params
    var pdata = pbuilder.data();

    // hack to pull in the cleanup option on the segment page
    if ($("#form_clean").length) {
        pdata.clean = $("#form_clean").val();
    }
    // server-size hack so we know it's using the iframe method
    pdata._iframe = 1;

    $("#uploadform").ajaxForm({
        data : pdata,
        dataType: "json",
        success: function(data, responseText, xhr) {
            onXHRLoad(data, responseText, xhr);
            $(elem).val("");
        },
    });
    $("#uploadform").submit();
}


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

    // refrwesh on compparm enter
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

    $("#singleupload").change(function(event) {
        doIframeUpload(this);
    });


    // hide the drag-drop zone for browsers other than firefox
    if (!($.browser.mozilla && 
                parseFloat($.browser.version.slice(0, 3)) >= 1.9)) {
        //$("#dragdrop").hide();
        var dd = $("#dragdrop");
        var hiddenupload = $("<input></input>")
            .attr("type", "file")
            .attr("id", "hiddenupload")
            .attr("name", "upload[]")
            .attr("multiple", "multiple")
            .css("opacity", "0.0")
            .css("z-index", 1000)
            .css("position", "absolute")
            .css("width", dd.outerWidth(true) + "px")
            .css("height", dd.outerHeight(true) + "px")
            .css("top", dd.offset().top + "px")
            .css("left", dd.offset().left + "px")
            .live("mouseenter mouseleave", function(event) {
                if (event.type == "mouseover") {
                    dd.addClass("hover");
                } else {
                    dd.removeClass("hover");
                }
            }).change(function(event) {
                doIframeUpload(this);
            }).appendTo($("#uploadform"));
    }

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


    // initialize the preset manager
    // this first bit's a hack
    var presettype = window.location.pathname.replace(/\/ocr\//g, "").replace(/\//g, "");
    presetmanager = new PresetManager("preset_container", presettype);
    presetmanager.onPresetLoadData = pbuilder.loadData;
    presetmanager.onPresetClear = pbuilder.reinit;

    // initialise the uploader...
    var uploader  = new AjaxUploader(window.location.pathname, "dropzone");
    uploader.onXHRLoad = onXHRLoad;
    uploader.onUploadsStarted = function(e) {
        // close anything that's already open in the viewer
        sdviewer.close();
        pbuilder.setWaiting(true);
        
        // slurp up the parameters.  Since the params are build 
        // dynamically this has to be done immediately before the
        // upload commences, hence in the onUploadsStarted handler
        $("#optionsform input[type='text'], #optionsform select").each(function() {
            uploader.registerTextParameter("#" + $(this).attr("id"));
        });
    };


    loadState();
});
