
// the uploader...
var uploader = null;


// init the seadragon viewer
var binviewer = null;
var srcviewer = null;

function syncViewer(viewer, other) {
    if (!viewer.isOpen() || !other.isOpen()) {
        return;
    }
    other.viewport.zoomTo(viewer.viewport.getZoom(), true);
    other.viewport.panTo(viewer.viewport.getCenter(), true);
}

function initViewers() {
    //Seadragon.Config.animationTime = 0.5;
    //Seadragon.Config.blendTime = 0.5;
    Seadragon.Config.maxZoomPixelRatio = 6;
    Seadragon.Config.imagePath = "/static/js/seadragon/img/";

    srcviewer = new Seadragon.Viewer("source_out");
    binviewer = new Seadragon.Viewer("binary_out");
    binviewer.addEventListener("animation", function(e) {
        syncViewer(binviewer, srcviewer);
    });
    srcviewer.addEventListener("animation", function(e) {
        syncViewer(srcviewer, binviewer);
    });
} 

$(function(e) {
    initViewers();
});


$(function() {
    

    $(".ocr_line").live("click", function(e) {
            //alert("clicked!");
    });

    $("#singleupload").change(function(event) {
        if ($(this).val() == "") {
            return false;
        }
        $("#uploadform").submit();
    });


   $("#uploadform").ajaxForm({
        data : { _iframe: 1 },
        dataType: "json",
        success: function(data, responseText, xhr) {
            onXHRLoad(data, responseText, xhr);
            $("#singleupload").val("");
        },
    });


    function processData(element, data) {
        if (!data || data.status == "PENDING") {
            setTimeout(function() {
                pollForResults(element);
                }, 500);
        } else if (data.error) {
            $("#binary_out_head").removeClass("waiting");
            element
                .addClass("error")
                .html("<h4>Error: " + data.error + "</h4>")
                .append(
                    $("<div></div>").addClass("traceback")
                        .append("<pre>" + data.trace + "</pre>")                                
                );                            
        } else if (data.status == "SUCCESS") {
            // set up the zoom slider according to the scale
            //$("#zoom").slider({"min": data.results.scale});

            element.data("src", data.results.src);
            element.data("dst", data.results.dst);
            if (binviewer.isOpen()) {
                var center = binviewer.viewport.getCenter();
                var zoom = binviewer.viewport.getZoom();
                binviewer.openDzi(data.results.dst);
                srcviewer.openDzi(data.results.src);
                binviewer.addEventListener("open", function(e) {
                    binviewer.viewport.panTo(center, true); 
                    binviewer.viewport.zoomTo(zoom, true); 
                });
            } else {
                binviewer.openDzi(data.results.dst);
                srcviewer.openDzi(data.results.src);
            }
            $("#binary_out_head").removeClass("waiting");
        } else {
            element.html("<p>Oops, task finished with status: " + data.status + "</p>");
        }
    } 
                

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

    // toggle the source and binary images
    $("#togglesrc").click(function(e) {
        var shift = "-" + $("#binary_out").css("height");
        if ($("#binary_out").css("margin-top") != shift) {
            $("#binary_out").css("margin-top", shift);
        } else {
            $("#binary_out").css("margin-top", "0px"); 
        }
    });

    // resubmit the form...
    $("#refresh").click(function(e) {
        
        var params = "&src=" + $("#binary_out").data("src") 
            + "&dst=" + $("#binary_out").data("dst")
            + "&" + $("#optionsform").serialize();
        $.post("/ocr/segment", params, function(data) {
            $("#binary_out").data("jobname", data[0].job_name);
            pollForResults($("#binary_out"));
        });
    });

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
            $("#binary_out_head").text(pagename).addClass("waiting");
            $("#binary_out")
                .data("jobname", pageresults.job_name);
            pollForResults($("#binary_out"));
        }); 
    };

    // initialise the binarising controls
    buildComponentOptions();
    $(".segoption").live("change", function(e) {
        reinitParams($(this));
    });


    // initialise the uploader...
    uploader  = new AjaxUploader("/ocr/segment", "dropzone");
    uploader.onXHRLoad = onXHRLoad;
    uploader.onUploadsStarted = function(e) {
        if (srcviewer.isOpen() && binviewer.isOpen()) {
            srcviewer.close();
            binviewer.close();
        }
        // slurp up the parameters.  Since the params are build 
        // dynamically this has to be done immediately before the
        // upload commences, hence in the onUploadsStarted handler
        $("#optionsform input, #optionsform select").each(function() {
            uploader.registerTextParameter("#" + $(this).attr("id"));
        });
    };

});


function reinitParams(binselect) {
    var compname = binselect.val();
    var paramlabel = $("<label></label>");
    var paraminput = $("<input type='text'></input>");
    var pdiv = binselect.next();
    if (pdiv.attr("tagName") == "DIV") {
        pdiv.html("");
        pdiv.remove();
    }
    // that'll do if we're just removing the component 
    if (compname == "") {
        return;
    }
    
    var params = PARAMS[compname].params;
    if (params.length) {
        pdiv = $("<div></div>").attr("class", "compparam");
        $.each(params, function(index, param) {
            var plabel = paramlabel.clone()
                .attr("foo", binselect.val() + "_option")
                .text(param.name);
            var pinput = paraminput.clone()
                .attr("name", binselect.val() + "__" + param.name)
                .attr("value", param.value);
            pdiv.append(plabel).append(pinput);
            binselect.after(pdiv);
        });
    }
}


function setupOptions(components) {

    var option = $("<option></option>");
    // build selects for each component type
    var segselect = $("<select></select>")
        .addClass("segoption")
        .attr("id", "psegmenter");
        
    $.each(components, function(name, component) {
            var newopt = option.clone()
            .attr("value", component.name)
            .text(component.name);
        segselect.append(newopt);
    });

    $("#options").append("<label>Segmenter</label>").attr("for", "psegmenter");
    $("#options").append(segselect);

    // set default option
    segselect.attr("name", "psegmenter").val("SegmentPageByRAST");
    
    // add appropriate options for components
    layoutOptions(components);
}


function layoutOptions(components) {
    var paramdiv = $("<div></div>").addClass("compparam");
    var paramlabel = $("<label></label>");
    var paraminput = $("<input type='text'></input>");
    // lay out parameter...
    //
    var cselect = $("#psegmenter");
    var compname = cselect.val();
    if (compname) {
        var component = components[compname];
        var compparams = component.params;
        var pdiv = paramdiv.clone().attr("id", cselect.attr("id") + "_options");
        $.each(compparams, function(index, param) {
            var paramname = compname + "__" + param.name;
            var plabel = paramlabel.clone()
                .attr("for", paramname)
                .text(param.name);
            var pinput = paraminput.clone()
                .attr("name", paramname)
                .attr("id", paramname)
                .val(param.value);
            pdiv.append(plabel).append(pinput);
            cselect.after(pdiv);            
        });
    }
}

var PARAMS = {}; // sorry, global.

function buildComponentOptions() {
    // get the component data for the types we want
    // returns a list component hashes
    $.getJSON("/ocr/components", "type=ISegmentPage", function(components) {
        PARAMS = components;
        setupOptions(components);        
    });
}


