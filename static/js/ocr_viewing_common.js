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

        if (png && outa) {
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
        }
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
            //sdviewer.setOutputB(data.results.dst + "?" + (new Date().getTime()));
        } else {
            element.data("outa", data.results.dst);
            //sdviewer.setOutputA(data.results.dst + "?" + (new Date().getTime()));
        }
//            alert("set primary buffer: " + data.results.dst);
        sdviewer.setOutput(data.results.dst);
        sdviewer.setSource(data.results.src);
        sdviewer.setWaiting(false);
        pbuilder.setWaiting(false);
        $(".interact_param").attr("disabled", false);
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
        sdviewer.setTitle(pagename);
        sdviewer.setWaiting(true);
        $("#viewerwindow")
            .data("jobname", pageresults.job_name);
        pollForResults($("#viewerwindow"));
    }); 
};



$(function() {

    // initialise the viewer
    sdviewer = new ImageWindow("viewerwindow"); 
    sdviewer.init();

    // refrwesh on compparm enter
    $(".compparam > input").live("keydown", function(event) {
        if (event.keyCode == 13) {
           refreshImage();            
           return false;
        }
    });

    // ajaxify the upload form
    $("#uploadform").ajaxForm({
        data : { _iframe: 1 },
        dataType: "json",
        beforeSend: function(e) {
            pbuilder.setWaiting(true);
        },
        success: function(data, responseText, xhr) {
            onXHRLoad(data, responseText, xhr);
            $("#singleupload").val("");
        },
    });


    // upload the image when the file input changes
    $("#singleupload").change(function(event) {
        if ($(this).val() == "") {
            return false;
        }
        $("#uploadform").submit();
    });

    // hide the drag-drop zone for browsers other than firefox
    if (!($.browser.mozilla && 
                parseFloat($.browser.version.slice(0, 3)) >= 1.9)) {
            $("#dragdrop").hide();
    }

    // make interactive params disabled at the start
    $(".interact_param").attr("disabled", true);



    // toggle the source and binary images
    $("#togglesrc").click(sdviewer.toggleSrc);
    $("#toggleab").click(sdviewer.toggleAB);

    getCropRect = function() {
        sdviewer.getCropRect();
    }


    // resubmit the form...
    $("#refresh").click(refreshImage);


    // initialize the preset manager
    // this first bit's a hack
    var presettype = window.location.pathname.replace(/\/ocr\//g, "").replace(/\//g, "");
    presetmanager = new PresetManager("preset_container", presettype);
    presetmanager.onPresetLoadData = pbuilder.loadData;
    presetmanager.onPresetClear = pbuilder.reinit;
    presetmanager.onBeforeAction = function(event) {
        //$(".ocroption, .compparam > input").attr("disabled", true);
    }
    presetmanager.onCompleteAction = function(event) {
        //$(".ocroption, .compparam > input").attr("disabled", false);
    }


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
