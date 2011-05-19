var transcript = null;
var sdviewer = null;
var pbuilder = null;
var formatter = null;
var polltimeout = -1;


function onBinaryFetchResult(data) {


}

function pollForResults(data, polltime) {
    if (data == null) {
        alert("Return data is null!");
    } else if (data.error) {
        alert(data.error);
    } else if (data.status == "PENDING") {
        $.ajax({
            url: "/ocr/viewer_binarization_results/" + data.task_id + "/",
            dataType: "json",
            beforeSend: function(e) {
                sdviewer.setWaiting(true);
            },
            complete: function(e) {
                sdviewer.setWaiting(false);  
            },
            success: function(data) {
                if (polltimeout != -1) {
                    clearTimeout(polltimeout);
                    polltimeout = -1;
                }
                polltimeout = setTimeout(function() {
                    pollForResults(data, polltime);
                }, polltime);        
            },
            error: OCRJS.ajaxErrorHandler,
        });
    } else if (data.status == "SUCCESS") {
        $(sdviewer).data("binpath", data.results.out);
        sdviewer.setBufferPath(0, data.results.dst);
        sdviewer.setWaiting(false);
    }
}

function reconvertLines(lines) {
    var linedata = [];
    lines.each(function(i, elem) {
        linedata.push( {
            line: $(elem).data("num"),
            box: $(elem).data("bbox"),
        });
    });
    var pdata = pbuilder.values();
    pdata["coords"] =  JSON.stringify(linedata);

    $.ajax({
        url: "/ocr/reconvert_lines/" + transcript.taskData().pk + "/",
        data: pdata,
        type: "POST",
        beforeSend: function(event) {
            lines.addClass("reconverting");
        },
        complete: function(data) {
        },
        success: function(data) {
            $.each(data.results, function(i, line) {
                var lineelem = document.getElementById("line_" + line.line);
                transcript.replaceLineText(lineelem, $(lineelem).text(), line.text);
                $(lineelem)
                    .removeClass("reconverting")
                    .addClass("reconverted");
                $("#save_data").button({disabled: false});                    
            });
        },
        error: OCRJS.ajaxErrorHandler,
    });
}


function unsavedPrompt() {
    return confirm("Save changes to transcript?");
}


function updateTask(event) {
    var abstaskpk = parseInt($("#task_pk").val());
    var hashoffset = parseInt(window.location.hash.replace(/^#!\//, ""));
    var batchoffset = parseInt($("#batchoffset").val());
    if (!isNaN(hashoffset)) {
        abstaskpk += hashoffset;
        batchoffset += hashoffset;
    }
    transcript.setTaskId(abstaskpk);
    console.log("Setting page slider to: " + batchoffset + " for task: " + abstaskpk);
    $("#page_slider").slider({value: batchoffset});
}

function updateNavButtons() {
    var ismax = $("#page_slider").slider("option", "value") 
            == $("#page_slider").slider("option", "max");
    var ismin = $("#page_slider").slider("option", "value") == 0; 
    $("#next_page").button({disabled: ismax});         
    $("#prev_page").button({disabled: ismin});
    $("#heading").button({disabled: true});
}

$(function() {
    // setup toolbar
    $("#centre").button({
        text: false,
        icons: {
            primary: "ui-icon-link",
        },
    });
    $("#spellcheck").button();
    $("#format").buttonset();
    $("#next_page").button({
        text: false,
        icons: {
            primary: "ui-icon-seek-next",
        },
    });
    $("#prev_page").button({
        disabled: true,
        text: false,
        icons: {
            primary: "ui-icon-seek-prev",
        },
    });
    $("#save_data").button({
        disabled: true,
        text: false,
        icons: {
            primary: "ui-icon-disk",
        },
    });
    $("#save_training_data").button({
        text: false,
        icons: {
            primary: "ui-icon-check",
        },
    });
    $("#heading").button({
        disabled: true,
        text: true,
    });
    $("#reocr").buttonset();
    $("#reocr_options").button({
        text: false,
        icons: {
            primary: "ui-icon-wrench",
        }        
    });


    $("#vlink").buttonset();

    $("#format_block").click(function(event) {
        formatter.blockLayout($(".transcript_lines"));
    });
    $("#format_line").click(function(event) {
        formatter.lineLayout($(".transcript_lines"));
    });
    $("#format_column").click(function(event) {
        formatter.columnLayout($(".transcript_lines"));
    });
    $("#page_slider").slider({
        min: 0,
        max: $("#batchsize").val() - 1,
        value: $("#batchoffset").val(),
    });
    
            
    // initialise the transcript editor
    transcript = new OCRJS.TranscriptEditor(document.getElementById("transcript"));    
    transcript.onTaskChange = function() {
        var ismax = $("#page_slider").slider("option", "value") 
                == $("#batchsize").val() - 1;
        var ismin = $("#page_slider").slider("option", "value") == 0; 
        $("#next_page").button({disabled: ismax});         
        $("#prev_page").button({disabled: ismin});
        $("#heading").button({disabled: true});
    }
    transcript.onLineSelected = function(type) {
        $("#heading").button({disabled: false});
        $("#heading").attr("checked", type == "h1")
            .button("refresh");
    }

    $("#reconvert").change(function(event) {
        $("#transcript_toolbar")
            .find("#spellcheck")
            .button({
                disabled: $(this).attr("checked"),
            });
        if (!$(this).prop("checked")) {
            //transcript.enable();
            $(".reconverted")
                .removeClass("reconverted");
            $(".ocr_line")
                .die("click.reconvert")
                .die("mouseover.reconvert")
                .die("mouseout.reconvert");
        } else {
            //transcript.disable();
            $(".ocr_line.hover").removeClass("hover");
            $(".ocr_line").live("click.reconvert", function(e) {
                positionViewer($(this).data("bbox"));
                reconvertLines($(this));
            }).live("mouseover.reconvert", function(e) {
                $(this).addClass("reconvert");    
            }).live("mouseout.reconvert", function(e) {
                $(this).removeClass("reconvert");    
            });
        }
    });

    $("#reocr, #reocr_options").change(function(event) {
        if ($("#options", $("#dialog")).length == 0) {
            $("#dialog").dialog({
                autoOpen: false,
                width: 350,
                close: function(event) {
                    $(elem).prop("checked", false).button("refresh");
                }
            }).append($("<div></div>").attr("id", "options"));
            pbuilder = new OCRJS.ParameterBuilder(
                    document.getElementById("options"));
            pbuilder.init();
        }
    });

    $("#reocr_options").change(function(event) {
        var elem = this;
        if ($(this).prop("checked")) {
            $("#dialog").dialog("open");
        } else {
            $("#dialog").dialog("close");
        }
    });

    $("#heading").change(function() {
        transcript.setCurrentLineType($(this).attr("checked") ? "h1" : "span");        
    });

    // When a page loads, read the data and request the source
    // image is rebinarized so we can view it in the viewer
    // This is likely to be horribly inefficient, at least
    // at first...
    transcript.addListener("onTaskLoad", function() {
        //var ismax = $("#page_slider").slider("option", "value") 
        //        == $("#batchsize").val() - 1;
        //var ismin = $("#page_slider").slider("option", "value") == 0; 
        //$("#next_page").button({disabled: ismax});         
        //$("#prev_page").button({disabled: ismin});
        //$("#heading").button({disabled: true});
        // get should-be-hidden implementation details
        // i.e. the task id that process the page.  We
        // want to rebinarize with the same params
        var task_pk = transcript.taskData().pk;
        $.ajax({
            url: "/ocr/submit_viewer_binarization/" + task_pk + "/",
            dataType: "json",
            beforeSend: function(e) {
                sdviewer.close();
                sdviewer.setWaiting(true);
            },
            success: function(data) {
                if (polltimeout != -1) {
                    clearTimeout(polltimeout);
                    polltimeout = -1;
                }
                pollForResults(data, 300);
            },
            error: OCRJS.ajaxErrorHandler,
        });
    });
    transcript.addListener("onTextChanged", function() {
        $("#save_data").button({
            disabled: false,
        });
    });
    transcript.addListener("onSave", function() {
        $("#save_data").button({
            disabled: true,
        });
    });
    transcript.addListener("onLinesReady", function() {
        // trigger a reformat
        $("input[name=format]:checked").click();
    });

    var positionViewer = function(position) {
        // ensure the given line is centred in the viewport
        var bounds = transcript.taskData().fields.results.box;
        var fw = bounds[2], fh = bounds[3];
        var x = position[0], y = position[1], w = position[2], h = position[3];        
        var rect = new Seadragon.Rect(x / fw, (y - h) / fw, w / fw, h / fw);
        sdviewer.setBufferOverlays({
            "current": [rect],
        });
        if ($("#centre").attr("checked")) {
            sdviewer.fitBounds(rect, true); 
        }
    }

    transcript.addListener("onHoverPosition", function(position) {
        if (!($("input[name=vlink]:checked").val() == "hover" 
                    && sdviewer.isReady()))
            return;
        positionViewer(position);
    });

    transcript.addListener("onClickPosition", function(position) {
        if (!($("input[name=vlink]:checked").val() == "click" 
                    && sdviewer.isReady()))
            return;
        positionViewer(position);
    });

    $("#spellcheck").change(function(event) {
        if ($(this).attr("checked")) {
            transcript.startSpellcheck();
        } else {
            transcript.endSpellcheck();
        }
    });

    $("#save_data").click(function(event) {
        transcript.save();
    });

    $("#save_training_data").click(function(event) {
        var pk = transcript.taskData().pk;
        $.ajax({
            url: "/reference_pages/create_from_task/" + pk + "/",
            dataType: "json",
            type: "POST",
            success: function(data) {
                if (data.error)
                    return alert("Error: " + data.error);
                alert("Saved!");
            },
            complete: function() {
            },
            error: OCRJS.ajaxErrorHandler,
        });
    });

    $("#page_slider").slider({
        change: function(e, ui) {            
            var val = $("#page_slider").slider("value");
            var diff = val - parseInt($("#batchoffset").val());
            var batchoffset = parseInt($("#batchoffset").val());            
            var hashoffset = parseInt(window.location.hash.replace(/^#!\//, ""));
            if (isNaN(hashoffset))
                hashoffset = 0;
            var diff = val - batchoffset;
            var orig = batchoffset + hashoffset;

            // return if nothing's changed
            if (hashoffset == diff)
                return;

            // check for unsaved changes
            if (transcript.hasUnsavedChanges()) {
                if (!unsavedPrompt()) {
                    $("#page_slider").slider({value: orig});
                    return;
                } else {
                    transcript.save();
                }
            } 
            window.location.hash = "#!/" + diff;
            
            // set the buttons accordingly
            updateNavButtons();
        },
    });

    $("#prev_page").click(function(event) {
        $("#page_slider").slider("option", "value", 
            $("#page_slider").slider("option", "value") - 1);    
    });
        

    $("#next_page").click(function(event) {
        $("#page_slider").slider("option", "value", 
            $("#page_slider").slider("option", "value") + 1);    
    });
    
    // line formatter object
    formatter = new OCRJS.LineFormatter();
    
    // viewer object
    sdviewer = new OCRJS.ImageViewer($("#viewer").get(0), {
        numBuffers: 1,
        height: 300,
    }); 
    
    updateTask();
    updateNavButtons();
    window.addEventListener("hashchange", updateTask);


    // maximise the height of the transcript page
    maximiseWidgets(transcript, sdviewer);
    $(window).resize(function(event) {
        maximiseWidgets(transcript, sdviewer);
    });
});        

