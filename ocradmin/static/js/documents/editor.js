var transcript = null,
    sdviewer = null,
    formatter = null,
    hsplitL, hsplitR,
    cmdstack = null,
    spellcheck = null,
    taskwatcher = null,
    polltimer = null;



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
    $("#status").buttonset();
    $("#navigate").buttonset();
    $("#next_page").button({
        disabled: !$("#id_next_pid").val(),
        text: false,
        icons: {
            primary: "ui-icon-seek-next",
        },
    });
    $("#prev_page").button({
        disabled: !$("#id_prev_pid").val(),
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
    $("#undo_command").button({
        text: false,
        disabled: true,
        icons: {
            primary: "ui-icon-arrowreturnthick-1-w",
        }
    });
    $("#redo_command").button({
        text: false,
        disabled: true,
        icons: {
            primary: "ui-icon-arrowreturnthick-1-e",
        }
    });

    $("#status_uncorrected").button({
        text: false,
        icons: {
            primary: "ui-icon-help",
        }
    });
    $("#status_part_corrected").button({
        text: false,
        icons: {
            primary: "ui-icon-pencil",
        }
    });
    $("#status_complete").button({
        text: false,
        icons: {
            primary: "ui-icon-check",
        }
    });

    $("#flag_document").button({
        text: false,
        icons: {
            primary: "ui-icon-flag",
        }
    });


    $("#vlink").buttonset();

    $("#format_block").click(function(event) {
        formatter.blockLayout($("#transcript"));
    });
    $("#format_column").click(function(event) {
        formatter.columnLayout($("#transcript"));
    });
    $("#undo_command").click(function(event) {
        cmdstack.undo();
    });
    $("#redo_command").click(function(event) {
        cmdstack.redo();
    });

    // map of key commands to functions
    var cmdmap = {
        "ctrl+del": function() {
            transcript.cmdDeleteLine();
        },
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
            transcript.finishEditing(element, initialcontent, true, true);
        });
    }

    function bindNavKeys() {
        unbindEditKeys();
        unbindNavKeys();
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

    $("input[name='status']").click(function(event) {
        var status = $("input[name='status']:checked").val();
        console.log("Setting status to ", status);
        $.ajax({
            url: "/documents/status/" + getPid() + "/",
            type: "POST",
            data: {status: status},
            dataType: "json",
            error: OcrJs.ajaxErrorHandler,
            success: function(data) {
                $("#id_status").val(data.status);
                console.log(data);
            },
        });
    });

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

    function unsavedPrompt() {
        return confirm("Save changes to transcript?");
    }

    function getPid() {
        return $("#page_name").data("val");
    }

    function getStatus() {
        return $("input[name='status']:checked").val();
    }

    function updateButtons() {
        $("#heading").button({disabled: true});
        $("#next_page").button({disabled: !$("#next_page").data("val")});
        $("#prev_page").button({disabled: !$("#prev_page").data("val")});
    }

    function positionViewer(position) {
        // ensure the given line is centred in the viewport
        if ($("#link_viewers").prop("checked"))
            sdviewer.fitBounds(position.dilate(20), true);
        sdviewer.clearHighlights();
        sdviewer.addHighlight(position);
        sdviewer.update();
    }

    function pageLoaded() {
        // get should-be-hidden implementation details
        // i.e. the task id that process the page.  We
        // want to rebinarize with the same params
        $("input[name=format]:checked").click();
        var task_pid = getPid();
        $("#edit_task").attr("href",
                "/presets/builder/" + task_pid + "?ref="
                + encodeURIComponent(window.location.href.replace(window.location.origin, "")));
        sdviewer.clearHighlights();
        taskwatcher.run("/documents/binary/" + task_pid + "/");
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

    taskwatcher = new OcrJs.TaskWatcher(300); // millisecond delay
    taskwatcher.addListeners({
        start: function() {
            sdviewer.setWaiting(true);
        },
        poll: function(count) {

        },
        error: function(msg) {
            alert(msg);
        },
        done: function(data) {
            sdviewer.setWaiting(false);
            $(sdviewer).data("binpath", data.results.out);
            sdviewer.openDzi(data.results.dst);
            sdviewer.goHome();
            sdviewer.resetSize();
            sdviewer.setWaiting(false);
        },
    });

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

    function showPluginPane(onoff) {
        widgetcontentsplit[onoff ? "show" : "hide"]("south");
    }

    // initialize spellcheck
    spellcheck = new OcrJs.Spellchecker($("#plugin"), cmdstack);
    spellcheck.addListeners({
        start: function() {
            unbindNavKeys();
            spellcheck.takeFocus();
        },
        stop: function() {
            spellcheck.looseFocus();
            bindNavKeys();
        },
        edit: function() {
            transcript.editLine();
        },
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
            url: "/documents/transcript/" + getPid() + "/",
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
                    alert(data);
                }
            },
        });
    };

    $("#save_data").click(function(event) {
        saveTranscript();
    });

    function updateTask(event) {
        var status = getStatus();
        if (status == "running") {
            transcript.setWaiting(true);
            if (polltimer != null)
                clearTimeout(polltimer);
            polltimer = setTimeout(function() {
                $.getJSON("/documents/status/" + getPid() + "/", function(data) {
                    console.log("Setting status", data.status);
                    $("input[value='" + data.status + "']").prop("checked", true);
                    updateTask();
                });
            }, 500);
        } else if (status != "error" && status != "initial") {
            clearTimeout(polltimer);
            polltimer = null;
            console.log("Loading ", getPid());
            $("#transcript").load("/documents/transcript/" + getPid() + "/",
                null, function(text) {
                    transcript.setWaiting(false);
                    transcript.refresh();
                    pageLoaded();
            });
        } else {
            transcript.setWaiting(false);
            alert("Unexpected status: " + status);
        }
    }

    $.address.change(function(event) {
        if (event.value != "/") {
            console.log("CHANGED!");
            $.ajax({
                url: "/documents/edit" + event.value + "/",
                error: OcrJs.ajaxErrorHandler,
                success: function(data) {
                    console.log(data);
                    $("#page_name").data("val", data.doc.pid).text(data.doc.label);
                    $("#next_page").data("val", (data.next || data.doc.pid))
                        .attr("href", "/documents/edit/" + (data.next || data.doc.pid) + "/");
                    $("#prev_page").data("val", (data.prev || data.doc.pid))
                        .attr("href", "/documents/edit/" + (data.prev || data.doc.pid) + "/");
                    $("input[value='" + data.doc.ocr_status + "']")
                        .prop("checked", true).button("refresh");
                    $("#edit_task").attr("href", "/presets/builder/" + data.doc.pid + "/");
                    updateButtons();
                    
                    updateTask();
                }
            });
        }
    });

    $(".nav_link").click(function(event) {
        $.address.value($(this).data("val"));
        event.preventDefault();
        event.stopPropagation();
    });
    
    // line formatter object
    formatter = new OcrJs.LineFormatter();
    
    // viewer object
    sdviewer = new DziViewer.Viewer($("#viewer").get(0), {
        numBuffers: 1,
        height: 300,
        dashboard: false,
    });
    
    $(window).unload(function() {
        saveState();
    });

    layoutmanager.addListeners({
        layoutChanged: function() {
            sdviewer.resetSize();
            $("input[name=format]:checked").click();
        },
        initialised: function() {
            sdviewer.resetSize();
            $("input[name=format]:checked").click();
            updateTask();
        }
    });

    updateButtons();
    window.addEventListener("hashchange", updateTask);

    // set up key commands
    bindNavKeys();

    loadState();
});

