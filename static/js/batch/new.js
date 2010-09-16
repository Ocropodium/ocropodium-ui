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
    $.cookie("engine", $("input[name=engine]:checked").attr("value"));
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


function doIframeUpload(elem) {
    if ($(elem).val() == "") {
        return false;
    }

    // get the extra params
    var pdata = {};
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
    var uploader = null;
    var filebrowser = null;

    // set up filebrowser
    $("#browse").click(function(event) {
        if (!filebrowser) {
            $("#file_browser").hide();
            filebrowser = new FileListWidget(
                $("#file_browser").get(0), 
                new FileDataSource(),
                {multiselect: true}
            );
            filebrowser.open = function() {
                addBatchFiles(filebrowser.files());
                filebrowser.close();
            }
            filebrowser.close = function() {
                $("#file_browser").dialog("close");
            }
        }

        $("#file_browser").dialog({
            width: 700,
            minHeight: 300,
            resize: function(e, ui) {
                filebrowser.resized(e);
                filebrowser.setHeight($(this).height());   
            },
            close: function(e) {
                filebrowser.clearSelection();
            },            
            modal: true,
        });
        event.preventDefault();
    });

    // HACK!  Can't work how to achieve these styling
    // bits without munging the dialog content css 
    // directly.  Obviously this is fragile
    $(".ui-dialog-content")
        .css("padding", "5px 2px 10px 2px")
        .css("margin-top", "0px")
        .css("overflow", "hidden");


    $("#singleupload").change(function(event) {
        doIframeUpload(this);
    });


    // hide the drag-drop zone for browsers other than firefox
    if (!($.browser.mozilla && 
                parseFloat($.browser.version.slice(0, 3)) >= 1.9)) {
        var dd = $("#dropzone");
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

