var pageobjects = [];

// Function to build the lang & char models selects when
// the engine type is changed.
function rebuildModelLists(appname) {
    var opt = $("<option />");
    var copt = $("#form_cmodel").val();
    var lopt = $("#form_lmodel").val();

    $("#uploadform").attr("disabled", "disabled");
    $.get(
        "/ocrmodels/search",
        { app: appname },
        function(response) {
            $("#form_cmodel").html("");
            $("#form_lmodel").html("");
            $.each(response, function(index, item) {
                var select = item.fields.type == "char"
                    ? $("#form_cmodel")
                    : $("#form_lmodel");

                var newopt = opt.clone()
                        .text(item.fields.name)
                        .attr("value", item.fields.name);
                if (item.fields.name == copt) {
                    newopt.attr("selected", "selected");
                }
                select.append(newopt);
            });
            $("#uploadform").removeAttr("disabled");
        }
    );
}


function saveState() {
    $.cookie("engine", $("input[@name=engine]:checked").attr("value"));
    $.each(["clean", "psegmenter", "cmodel", "lmodel"], function(index, item) {
        $.cookie(item, $("select[name=" + item + "]").attr("value"));     
    });

    // save the job names of the current pages...
    var jobnames = $(".ocr_page").map(function(i, d) {
        return $(d).data("jobname");
    }).get().join(",");
    if (jobnames) {
        $.cookie("jobnames", jobnames);
    }
}


function loadState() {
    var engine = $.cookie("engine");
    if (engine) {
        $("input[value='" + engine + "']").attr("checked", true);
    }
    $.each(["clean", "psegmenter", "cmodel", "lmodel"], function(index, item) {
        var val = $.cookie(item);
        if (val) {
            $("select[name=" + item + "]").val(val);
        }
    });

    /*var jobnames = $.cookie("jobnames");
    if (jobnames) {
        var joblist = jobnames.split(",");
        $.each(joblist, function(index, jobname) {
            pageobjects[index] = new OcrPage("workspace", index, jobname);
            pageobjects[index].pollForResults();            
        });
    }*/
}

// save state on leaving the page... at least try to...
window.onbeforeunload = function(event) {
    saveState();
}


var uploader = null;
var pbuilder = null;

$(function() {

    $("#singleupload").change(function(event) {
        if ($(this).val() == "") {
            return false;
        }

        // get the extra params
        var pdata = pbuilder.data();
        pdata.engine = $("input[@name=engine]:checked").val();
        // server-size hack so we know it's using the iframe method
        pdata._iframe = 1;

        $("#uploadform").ajaxForm({
            data : pdata,
            dataType: "json",
            success: function(data, responseText, xhr) {
                onXHRLoad(data, responseText, xhr);
                $("#singleupload").val("");
            },
        });
        $("#uploadform").submit();
    });


    // hide the drag-drop zone for browsers other than firefox
    if (!($.browser.mozilla && 
                parseFloat($.browser.version.slice(0, 3)) >= 1.9)) {
            $("#dragdrop").hide();
    }

    $("input[name=engine]").change(function(e) {
        rebuildModelLists($(this).val());
    });


    function onXHRLoad(event_or_response) {
        var data;
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
            // save the job names of the current pages...
            var jobnames = [];
            data = event_or_response;
        }

        if (data.error) {
            alert("Error: " + data.error + "\n\n" + data.trace);
            $("#dropzone").text("Drop images here...").removeClass("waiting");
            return;
        }
        $.each(data, function(pagenum, pageresults) {
            pageobjects[pagenum] = new OcrPage("workspace", pagenum, pageresults.job_name);
            pageobjects[pagenum].pollForResults((300 * uploader.size()) + (pagenum * 250));
        }); 
    };


    // initialise the uploader...
    uploader  = new AjaxUploader("/ocr/convert", "dropzone");
    uploader.onXHRLoad = onXHRLoad;
    uploader.onUploadsStarted = function(e) {
        uploader.registerTextParameter("input[@name=engine]:checked"); 
        $("#optionsform input[type='text'], #optionsform select").each(function() {
            uploader.registerTextParameter("#" + $(this).attr("id"));
        });
    };

    // load state stored from last time
    loadState();

    // fetch the appropriate models...
    rebuildModelLists($("input[name=engine]:checked").val());    

    // initialise the controls
    pbuilder = new ParameterBuilder("options", ["ISegmentLine", "IGrouper"]);
    pbuilder.registerComponent("grouper", "Grouper", "StandardGrouper");
    pbuilder.registerComponent("segmenter", "Line Segmenter", "DpSegmenter");
    pbuilder.init();
});

