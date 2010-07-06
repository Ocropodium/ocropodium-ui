// Initialisation operations common to both the binarizer
// view and the segmentation view (and probably some others)

var sdviewer = null;
var presetmanager = null;

function saveState() {
    if (sdviewer) {
        var src = $("#viewerwindow").data("src");
        var outa = $("#viewerwindow").data("outa");        
        var outb = $("#viewerwindow").data("outb");        

        if (outa && src) {
            var winprefix = window.location.pathname.replace(/\//g, "");
            $.cookie(winprefix + "_srcdzi", src);
            $.cookie(winprefix + "_outadzi", outa);
            $.cookie(winprefix + "_outbdzi", outb);
        }
    }
}

function loadState() {
    if (sdviewer) {
        var winprefix = window.location.pathname.replace(/\//g, "");
        var src = $.cookie(winprefix + "_srcdzi");
        var outa = $.cookie(winprefix + "_outadzi");
        var outb = $.cookie(winprefix + "_outbdzi");

        if (src && outa) {
            sdviewer.setSource(src);
            sdviewer.setOutputA(outa);
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



$(function() {

    // initialise the viewer
    sdviewer = new ImageWindow("viewerwindow"); 
    sdviewer.init();
    
   // ajaxify the upload form
   $("#uploadform").ajaxForm({
        data : { _iframe: 1 },
        dataType: "json",
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

    // Process the data completed results data... in this case
    // set the viewer source and output paths
    function processData(element, data) {
        if (!data || data.status == "PENDING") {
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
            element.data("src", data.results.src);
            if (data.results.dst.search("_b.dzi") != -1) {
                element.data("outb", data.results.dst);
                sdviewer.setOutputB(data.results.dst + "?" + (new Date().getTime()));
            } else {
                element.data("outa", data.results.dst);
                sdviewer.setOutputA(data.results.dst + "?" + (new Date().getTime()));
            }

            sdviewer.setSource(data.results.src + "?" + (new Date().getTime()));
            sdviewer.setWaiting(false);
            $(".interact_param").attr("disabled", false);
        } else {
            element.html("<p>Oops, task finished with status: " + data.status + "</p>");
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
                element.addClass("error")
                    .html("<h4>Http Error</h4>")
                    .append("<div>" + errorThrown + "</div>");                
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


    // toggle the source and binary images
    $("#togglesrc").click(sdviewer.toggleSrc);
    $("#toggleab").click(sdviewer.toggleAB);

    getCropRect = function() {
        sdviewer.getCropRect();
    }


    // resubmit the form...
    $("#refresh").click(function(e) {
        // check if we need to crop the re-binarized section
        if ($("#cropsize").attr("checked")) {
                        
        }    


        sdviewer.setWaiting(true);
        var params = "&src=" + $("#viewerwindow").data("src") 
            + "&dst=" + sdviewer.activeOutputPath()
            + "&" + $("#optionsform").serialize();
        $.post(window.location.pathname, params, function(data) {
            $("#viewerwindow").data("jobname", data[0].job_name);
            pollForResults($("#viewerwindow"));
        });
    });

    // initialise the controls
    buildComponentOptions();

    // rebuild the params when components change
    $(".ocroption").live("change", function(e) {
        reinitParams($(this));
    });


    // initialize the preset manager
    // this first bit's a hack
    var presettype = window.location.pathname.replace(/\/ocr\//g, "").replace(/\//g, "");
    presetmanager = new PresetManager("preset_container", presettype);
    presetmanager.onPresetClear = buildComponentOptions;
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
        
        // slurp up the parameters.  Since the params are build 
        // dynamically this has to be done immediately before the
        // upload commences, hence in the onUploadsStarted handler
        $("#optionsform input, #optionsform select").each(function() {
            uploader.registerTextParameter("#" + $(this).attr("id"));
        });
    };


    loadState();
});
