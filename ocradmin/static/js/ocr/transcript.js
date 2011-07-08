var transcript = null;
var sdviewer = null;
var formatter = null;
var polltimeout = -1;
var hsplitL, hsplitR;



function saveState() {
    var view = {
        follow: $("input[name='vlink']:checked").attr("id"),
        format: $("input[name='format']:checked").attr("id"), 
    };
    $.cookie("transcript_view", JSON.stringify(view));
}    

function loadState() {
    var viewcookie = $.cookie("transcript_view");
    if (viewcookie) {
        var view = JSON.parse(viewcookie);
        $("#" + view.follow).prop("checked", true).button("refresh");
        $("#" + view.format).prop("checked", true).button("refresh");
    }
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
        url: "/ocr/reconvert_lines/" + transcript.taskId() + "/",
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
    $("#link_viewers").button({
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
    $("#edit_task").button({
        text: false,
        icons: {
            primary: "ui-icon-wrench",
        },
    });
    $("#heading").button({
        disabled: true,
        text: true,
    });

    $("#image_zoomin").click(function(event) {
        sdviewer.zoomBy(2);        
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#image_zoomout").click(function(event) {
        sdviewer.zoomBy(0.5);    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });
    $("#centre").click(function(event) {
        sdviewer.goHome();    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-home",
        }
    });
    $("#fullscreen").click(function(event) {
        sdviewer.setFullPage(true);    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-arrow-4-diag",
        }
    });

    $("#refresh").click(function(event) {
        var active = sdviewer.activeBuffer();
        sdviewer.setBufferPath(active, sdviewer.bufferPath(active));    
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }
    });


    $("#vlink").buttonset();

    $("#format_block").click(function(event) {
        formatter.blockLayout($(".transcript_lines"));
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
        $("#heading").prop("checked", type == "h1")
            .button("refresh");
    }

    $("#reconvert").change(function(event) {
        $("#transcript_toolbar")
            .find("#spellcheck")
            .button({
                disabled: $(this).prop("checked"),
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

    // When a page loads, read the data and request the source
    // image is rebinarized so we can view it in the viewer
    // This is likely to be horribly inefficient, at least
    // at first...
    transcript.addListeners({
            onTaskLoad: function() {
            // get should-be-hidden implementation details
            // i.e. the task id that process the page.  We
            // want to rebinarize with the same params
            var task_pk = transcript.taskId();
            $("#edit_task").attr("href",
                    "/presets/builder/" + task_pk + "?ref="
                    + encodeURIComponent(window.location.href.replace(window.location.origin, "")));
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
            })
        },
        onTextChanged: function() {
            $("#save_data").button({
                disabled: false,
            });
        },
        onSave: function() {
            $("#save_data").button({
                disabled: true,
            });
        },
        onLinesReady: function() {
            // trigger a reformat
            $("input[name=format]:checked").click();
        },
    });

    var positionViewer = function(position) {
        // ensure the given line is centred in the viewport
        sdviewer.setBufferOverlays({
            "current": [position],
        });
        if ($("#link_viewers").prop("checked")) {
            sdviewer.fitBounds(position, true); 
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
        if ($(this).prop("checked")) {
            transcript.startSpellcheck();
        } else {
            transcript.endSpellcheck();
        }
    });

    $("#save_data").click(function(event) {
        transcript.save();
    });

    $("#save_training_data").click(function(event) {
        var pk = transcript.taskId();
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
        dashboard: false,                     
    }); 
    
    updateTask();
    updateNavButtons();
    window.addEventListener("hashchange", updateTask);

    hsplitL = $("#maincontent").layout({
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0, 
        },
    });

    hsplitR = $("#sidebar").layout({
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0, 
        },
    });

    hsplitL.options.center.onresize_end = function() {
        setTimeout(function() {
            transcript.resetSize();
            $("input[name=format]:checked").click();
        });
    };
    hsplitR.options.center.onresize_end = function() {
        setTimeout(function() {
            var active = sdviewer.activeBuffer();
            sdviewer.setBufferPath(active, sdviewer.bufferPath(active));
            sdviewer.resetSize();
            $("input[name=format]:checked").click();
        });
    };

    $(window).unload(function() {
        saveState();
    });

    $(window).resize();

    loadState();
});        

