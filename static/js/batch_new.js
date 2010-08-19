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
        $("#uploadform").ajaxForm({
            data : {_iframe: 1},
            dataType: "json",
            success: function(data, responseText, xhr) {            
                onXHRLoad(data, responseText, xhr);
                $("#singleupload").val("");
            },
            error: function(xhr, err) {
                alert(err);
            },
        }).submit();
        return false;
    });


    // hide the drag-drop zone for browsers other than firefox
    if (!($.browser.mozilla && 
                parseFloat($.browser.version.slice(0, 3)) >= 1.9)) {
            $("#dragdrop").hide();
    }

    $("input[name=engine]").change(function(e) {
        rebuildModelLists($(this).val());
    });

    // toggle selection of files
    $(".file_item").live("click", function(event) {
        $(this).toggleClass("selected");
    });

    // enable the submit button if appropriate
    $("#batch_name").keyup(updateButtons);

    function updateButtons() {
        var gotname = $.trim($("#batch_name").val()).length > 0;
        $("#submit_batch, #tabs_2_next").attr("disabled", !gotname);
        $("#tabs").tabs(gotname ? "enable" : "disable", 1);

        var gotfiles = $("#batch_file_list").children().length > 0;
        $("#submit_batch, #tabs_3_next").attr("disabled", !(gotfiles && gotname));
        $("#tabs").tabs((gotname && gotfiles) ? "enable" : "disable", 2);
    };

    function stripeFileList() {
        $(".file_item").each(function(i, elem) {
            var iseven = i % 2 == 0;
            $(elem)
                .toggleClass("odd", !iseven)
                .toggleClass("even", iseven);
        });
    }

    function removeSelectedBatchFiles() {
        $(".file_item.selected").remove();
        stripeFileList();
    }

    function addBatchFiles(filelist) {
        var fileitem = $("<div></div>").addClass("file_item");
        $.each(filelist, function(i, filename) {
            $("#batch_file_list").append(
                fileitem.clone().text(filename));
        });
        stripeFileList();
        updateButtons();
    }

    $("#browse").click(function(event) {
        var fbrowser = new FileBrowser("file_browser");
        fbrowser.onClose = function(e) {
            addBatchFiles(fbrowser.getValue());
        };
        fbrowser.showModal();
        event.preventDefault();
    });

    $(window).keydown(function(event) {
        if (event.keyCode == 46) {
            removeSelectedBatchFiles();
            updateButtons();
        } 
    });

    // disallow text selection of file_items
    $("#batch_file_list").bind("mouseup", function(event) {
        return false;
    });
    
    $("#submit_batch").click(function(event) {
        // munge filenames into a break-separated string... maybe
        // this will work...
        var paths = $.map($("#batch_file_list").children(), function(val) {
            return $(val).text();
        }).join(",");
        
        // standard OCR options
        var batchopts = $("#batchform").serialize();
        
        // build full string...
        var params =  batchopts + "&files=" + paths;
        $.ajax({
            url: "/batch/create/",
            type: "POST",
            data: params,
            dataType: "json",
            beforeSend: function() {
                $("#batchform").addClass("waiting");
            },
            success: function(data) {
                window.location = "/batch/latest/";
            },
            complete: function() {
                $("#batchform").removeClass("waiting");
            },
        });
        
        event.preventDefault();
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
            data = event_or_response;
        }
        if (data.error) {
            alert("Error: " + data.error + "\n\n" + data.trace);
            $("#dropzone").text("Drop images here...").removeClass("waiting");
            return;
        }
        addBatchFiles(data);
    };


    // initialise the uploader...
    uploader  = new AjaxBatchUploader("/batch/upload_files/", "dropzone");
    uploader.onXHRLoad = onXHRLoad;

    // make steps into tabs
    $(".next_tab").click(function(event) {
        var tabid = $(this).attr("id").replace(/_next/, "_link");
        $("#" + tabid).trigger("click");
    });
    $("#tabs").tabs( { disabled: [2], } );

    // load state stored from last time
    loadState();

    // fetch the appropriate models...
    rebuildModelLists($("input[name=engine]:checked").val());    
});

