var transcript = null;
var sdviewer = null;
var formatter = null;
var polltimeout = -1;
var hsplitL, hsplitR;
var cmdstack = null;
var lineedit = null;
var spellcheck = null;



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
        sdviewer.viewport.zoomIn(2);
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#image_zoomout").click(function(event) {
        sdviewer.viewport.zoomOut(0.5);
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
        sdviewer.refresh();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }
    });


    $("#vlink").buttonset();

    $("#format_block").click(function(event) {
        formatter.blockLayout($("#transcript"));
    });
    $("#format_column").click(function(event) {
        formatter.columnLayout($("#transcript"));
    });
    $("#page_slider").slider({
        min: 0,
        max: $("#batchsize").val() - 1,
        value: $("#batchoffset").val(),
    });
    $("#undo_command").click(function(event) {
        cmdstack.undo();
    });
    $("#redo_command").click(function(event) {
        cmdstack.redo();
    });

    // map of key commands to functions
    var cmdmap = {
        "ctrl+z": function() { 
            cmdstack.undo();
        },
        "ctrl+shift+z": function() {
            cmdstack.redo();
        },
        "ctrl+shift+s": function() { 
            $("#spellcheck").click();
        },
        "alt+ctrl+s": function() {
            saveTranscript();
        },
        "tab": function() {
            transcript.forward();
        },
        "shift+tab": function() {
            transcript.backward();
        },
        "f2": function() {
            transcript.editLine();
        },
    };

    var editcmdmap = {
        "esc": function(element, content) {
            transcript.finishEditing(element, content, false);
        },
        "return": function(element, content) {
            transcript.finishEditing(element, content, true);
        },
        "shift+tab": function(element, content) {
            transcript.finishEditing(element, content, true);
            transcript.backward();
            transcript.editLine();
        },
        "tab": function(element, content) {
            transcript.finishEditing(element, content, true);
            transcript.forward();
            transcript.editLine();
        },
    };

    function bindEditKeys(element, initialcontent) {
        unbindEditKeys();
        unbindNavKeys();
        $.each(editcmdmap, function(key, handler) {
            $(document).bind("keydown.editkeycmd", key, function(event) {
                handler(element, initialcontent);
                event.stopPropagation();
                event.preventDefault();
            });
        });
        $(element).bind("blur.editkeycmd", function(event) {
            transcript.finishEditing(element, initialcontent, true);
        });
    }

    function bindNavKeys() {
        unbindEditKeys();
        unbindEditKeys();
        $.each(cmdmap, function(key, handler) {
            $(document).bind("keydown.keycmd", key, function(event) {
                handler.apply();
                event.stopPropagation();
                event.preventDefault();
            });
        });
    }

    function unbindNavKeys() {
        $(document).unbind(".keycmd");
    }

    function unbindEditKeys(element) {
        $(document).unbind(".editkeycmd");
        $(element).unbind(".editkeycmd");
    }


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
                error: OcrJs.ajaxErrorHandler,
            });
        } else if (data.status == "SUCCESS") {
            $(sdviewer).data("binpath", data.results.out);
            sdviewer.openDzi(data.results.dst);
            sdviewer.setWaiting(false);
        }
    }

    function unsavedPrompt() {
        return confirm("Save changes to transcript?");
    }

    function getBatchOffset() {
        var batchoffset = parseInt($("#batchoffset").val());
        var hashoffset = parseInt(window.location.hash.replace(/^#!\//, ""));
        if (!isNaN(hashoffset))
            batchoffset += hashoffset;
        return batchoffset;
    }

    function getTaskPk() {
        var abstaskpk = parseInt($("#task_pk").val());
        var hashoffset = parseInt(window.location.hash.replace(/^#!\//, ""));
        if (!isNaN(hashoffset))
            abstaskpk += hashoffset;
        return abstaskpk;
    }


    function updateTask(event) {
        $("#transcript").load("/ocr/task_transcript/" + getTaskPk() + " .ocr_page:first",
                null, function(text) {
                    transcript.setWaiting(false);
                    transcript.refresh();
                    pageLoaded();
        });
        $("#page_slider").slider({value: getBatchOffset()});
    }

    function updateNavButtons() {
        var ismax = $("#page_slider").slider("option", "value")
                == $("#page_slider").slider("option", "max");
        var ismin = $("#page_slider").slider("option", "value") == 0;
        $("#next_page").button({disabled: ismax});
        $("#prev_page").button({disabled: ismin});
        $("#heading").button({disabled: true});
    }

    function positionViewer(position) {
        // ensure the given line is centred in the viewport
        //sdviewer.setBufferOverlays({
        //    "current": [position],
        //});
        if ($("#link_viewers").prop("checked")) {
            sdviewer.fitBounds(position.dilate(20), true);
            sdviewer.clearHighlights();
            sdviewer.addHighlight(position);
            sdviewer.update();
        }
    }

    function pageLoaded() {
        // get should-be-hidden implementation details
        // i.e. the task id that process the page.  We
        // want to rebinarize with the same params
        var task_pk = getTaskPk();
        $("#edit_task").attr("href",
                "/presets/builder/" + task_pk + "?ref="
                + encodeURIComponent(window.location.href.replace(window.location.origin, "")));
        $.ajax({
            url: "/ocr/submit_viewer_binarization/" + task_pk + "/",
            dataType: "json",
            beforeSend: function(e) {
                //sdviewer.close();
                sdviewer.setWaiting(true);
            },
            success: function(data) {
                if (polltimeout != -1) {
                    clearTimeout(polltimeout);
                    polltimeout = -1;
                }
                pollForResults(data, 300);
            },
            error: OcrJs.ajaxErrorHandler,
        })
    }

    function stackChanged() {
        $("#undo_command")
            .text(cmdstack.undoText())
            .button({disabled: !cmdstack.canUndo()})
            .button("refresh");
        $("#redo_command")
            .text(cmdstack.redoText())
            .button({disabled: !cmdstack.canRedo()})
            .button("refresh");
        $("#save_data").button({
            disabled: !cmdstack.canUndo(),
        });
    }

    // initialize undo stack
    cmdstack = new OcrJs.UndoStack(this, {max: 50});

    cmdstack.addListeners({
        undoStateChanged: stackChanged,
        redoStateChanged: stackChanged,
        indexChanged: stackChanged,
        stateChanged: function() {
        },
    });

    // initialise the transcript editor
    //transcript = new OcrJs.TranscriptEditor(document.getElementById("transcript"));
    transcript = new OcrJs.HocrEditor.Editor($("#transcript").get(0), cmdstack);

    lineedit = new OcrJs.LineEditor();
    lineedit.addListeners({
        onEditingFinished: function(element, origtext, newtext) {
            transcript.cmdReplaceLineText(element, origtext, newtext);
        },
        //onEditNextElement: function() {
        //    transcript.forward();
        //},
        //onEditPrevElement: function() {
        //    transcript.backward();
        //},
    });

    function showPluginPane(onoff) {
        hsplitL[onoff ? "show" : "hide"]("south");
    }

    // initialize spellcheck
    spellcheck = new OcrJs.Spellchecker($("#plugin"), cmdstack);
    spellcheck.addListeners({
        onWordCorrection: function() {
        },
        onWordHighlight: function(element) {
            transcript.setCurrentLine($(element).closest(".ocr_line"));
        },
    });
    
    // When a page loads, read the data and request the source
    // image is rebinarized so we can view it in the viewer
    // This is likely to be horribly inefficient, at least
    // at first...
    transcript.addListeners({
        //onTaskChange: function() {
        //    var ismax = $("#page_slider").slider("option", "value")
        //            == $("#batchsize").val() - 1;
        //    var ismin = $("#page_slider").slider("option", "value") == 0;
        //    $("#next_page").button({disabled: ismax});
        //    $("#prev_page").button({disabled: ismin});
        //    $("#heading").button({disabled: true});
        //},
        hoverPosition: function(position) {
            if (!($("input[name=vlink]:checked").val() == "hover"
                    && sdviewer.isReady()))
            return;
            positionViewer(position);
        },
        clickPosition: function(position) {
            if (!($("input[name=vlink]:checked").val() == "click"
                        && sdviewer.isReady()))
                return;
            positionViewer(position);
        },
        startEditing: function(element) {
            unbindNavKeys();
            bindEditKeys(element, $(element).html());
        },
        stopEditing: function(element, content) {
            unbindEditKeys(element);
            bindNavKeys();
        },
    });

    $("#spellcheck").change(function(event) {
        if ($(this).prop("checked")) {
            showPluginPane(true);
            spellcheck.spellcheck($(".ocr_line"));
        } else {
            spellcheck.unhighlight($(".ocr_line"));
            showPluginPane(false);
        }
    });

    function saveTranscript(fun, funargs) {
        $.ajax({
            url: "/ocr/save/" + getTaskPk() + "/",
            data: {
                data: transcript.getData()
            },
            dataType: "json",
            type: "POST",
            error: OcrJs.ajaxErrorHandler,
            success: function(data) {
                if (data && data.ok) {
                    $("#save_data").button({
                        disabled: true,
                    });
                    if (fun)
                        fun.apply(this, funargs);
                } else {
                    console.error(data);
                }
            },
        });
    };

    $("#save_data").click(function(event) {
        saveTranscript();
    });

    $("#save_training_data").click(function(event) {
        var pk = getTaskPk();
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
            error: OcrJs.ajaxErrorHandler,
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

            function updatePage() {
                sdviewer.clearHighlights();
                window.location.hash = "#!/" + diff;
                $("input[name=format]:checked").click();
                updateNavButtons();
            }

            // check for unsaved changes
            if (cmdstack.canUndo()) {
                if (!unsavedPrompt()) {
                    $("#page_slider").slider({value: orig});
                } else {
                    saveTranscript(updatePage);
                }
                return;
            }
            updatePage();
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
    formatter = new OcrJs.LineFormatter();
    
    // viewer object
    sdviewer = new DziViewer.Viewer($("#viewer").get(0), {
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
        south: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0,
            initClosed: true,
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
            sdviewer.resetSize();
            transcript.resetSize();
            $("input[name=format]:checked").click();
        });
    };
    hsplitR.options.center.onresize_end = function() {
        setTimeout(function() {
            sdviewer.resetSize();
            transcript.resetSize();
            $("input[name=format]:checked").click();
        });
    };

    $(window).unload(function() {
        saveState();
    });

    $(window).resize();
    sdviewer.resetSize();

    // set up key commands
    bindNavKeys();

    loadState();
});

