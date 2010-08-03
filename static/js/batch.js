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
            pageobjects[index] = new OcrPage("pageout", index, jobname);
            pageobjects[index].pollForResults();            
        });
    }*/
}

// save state on leaving the page... at least try to...
window.onbeforeunload = function(event) {
    saveState();
}



$(function() {
    var uploader = null;


    $("#singleupload").change(function(event) {
        if ($(this).val() == "") {
            return false;
        }

        //alert($(this).attr("value"));
        $("#uploadform").submit();
    });

    $("#uploadform").ajaxForm({
        data : { _iframe: 1 },
        dataType: "json",
        success: function(data, responseText, xhr) {
            //$("#pageout").html("");
            onXHRLoad(data, responseText, xhr);
            $("#singleupload").val("");
        },
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
        pageobjects[0] = new OcrBatch("document_window", data.job_name, data.subtasks);
        pageobjects[0].pollForResults(300 * uploader.size());
    };


    // initialise the uploader...
    uploader  = new AjaxBatchUploader("/ocr/batch", "dropzone");
    uploader.onXHRLoad = onXHRLoad;
    uploader.onUploadsStarted = function(e) {
        $("#document_window").html("");
        uploader.registerTextParameter("input[@name=engine]:checked"); 
        uploader.registerTextParameter("#form_clean"); 
        uploader.registerTextParameter("#form_segmenter"); 
        uploader.registerTextParameter("#form_cmodel"); 
        uploader.registerTextParameter("#form_lmodel"); 
    };

    // load state stored from last time
    loadState();

    // fetch the appropriate models...
    rebuildModelLists($("input[name=engine]:checked").val());    
});

