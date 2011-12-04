//
// Create presets using the tree builder.
//

// only in global scope for dubugging purposes
var uploader = null,
    draguploader = null,
    formatter = null,
    nodetree = null,
    nodeparams = null,
    nodemenu = null,
    cmdstack = null,
    sdviewer = null,
    hocrviewer = null,
    reshandler = null,
    presetmanager = null,
    guimanager = null,
    resultcache = {},
    statusbar = null,
    statemanager = null;

$(function() {

    // we don't want any button to have the default focus,
    // so put it on a dummy button and hide it
    $("#focus_dummy").focus().hide();

    // script builder buttons
    $("#show_file_menu").button({
        text: false,
        icons: {
            primary: "ui-icon-document",
            secondary: "ui-icon-carat-1-s",
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
    $("#stop_refresh").button({
        text: false,
        icons: {
            primary: "ui-icon-refresh",
        }
    });
    $("#focus_script").button({
        text: false,
        icons: {
            primary: "ui-icon-home",
        }
    });
    $("#layout_nodes").button({
        text: false,
        icons: {
            primary: "ui-icon-grip-dotted-vertical",
        }
    });
    $("#clear_cache").button({
        text: false,
        icons: {
            primary: "ui-icon-suitcase",
        }
    });
    $("#save_task_preset").button({
        icons: {
            primary: "ui-icon-arrowreturnthick-1-w",
        }
    });
    $("#cancel_task_preset").button({
        icons: {
            primary: "ui-icon-cancel",
        }
    });


    // viewer toolsbar
    // style toolbar
    $(".tbbutton").button({
        disabled: false,
    });
    $("#format").buttonset();
    $("#hocr_zoomin").click(function(event) {
        hocrviewer.increaseFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#hocr_zoomout").click(function(event) {
        hocrviewer.reduceFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });
    $("#format_block").click(function(event) {
        formatter.blockLayout(hocrviewer.container());
    });
    $("#format_column").click(function(event) {
        formatter.columnLayout(hocrviewer.container());
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
    $("#text_zoomin").click(function(event) {
        textviewer.increaseFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#text_zoomout").click(function(event) {
        textviewer.reduceFontSize();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
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

    $("#focus_script").click(function(event) {
        nodetree.centreTree();
        event.preventDefault();
        event.stopPropagation();
    });
    $("#layout_nodes").click(function(event) {
        var self = this;
        var aspect = $("#node_canvas").width() / $("#node_canvas").height();
        $.ajax({
            url: "/presets/layout_graph",
            type: "POST",
            data: {
                script: JSON.stringify(nodetree.buildScript()),
                aspect: aspect
            },
            success: function(data) {
                nodetree.cmdLayoutNodes(data);
            },
            error: OcrJs.ajaxErrorHandler,
        });
        event.preventDefault();
        event.stopPropagation();
    });
    $("#clear_cache").click(function(event) {
        resultcache = {};
        $.ajax({
            url: "/presets/clear_cache/",
            type: "POST",
            dataType: "JSON",
            error: OcrJs.ajaxErrorHandler,
            success: function(data) {
                if (data && data.ok)
                    alert("Cache cleared");
                else
                    console.error("Unexpect result on cache clear", data);
            },
        });
        event.preventDefault();
        event.stopPropagation();
    });
    $("#clear_node_cache").click(function(event) {
        resultcache = {};
        $.ajax({
            url: "/presets/clear_node_cache/",
            data: {
                node: nodetree.getEvalNode(),
                script: JSON.stringify(nodetree.buildScript()),
            },
            type: "POST",
            dataType: "JSON",
            error: OcrJs.ajaxErrorHandler,
            success: function(data) {
                if (data && data.ok)
                    alert("Cache cleared");
                else
                    console.error("Unexpect result on cache clear", data);
            },
        });
        event.preventDefault();
        event.stopPropagation();
    });
    $("#undo_command").click(function(event) {
        cmdstack.undo();
    });
    $("#redo_command").click(function(event) {
        cmdstack.redo();
    });

    // map of key commands to functions
    var globalcmdmap = {
        "ctrl+z": function() { 
            cmdstack.undo();
        },
        "ctrl+shift+z": function() {
            cmdstack.redo();
        },
        "ctrl+u": function() {
            runScript();
        },
        "alt+ctrl+l": function() {
            
        }
    };
    $.each(globalcmdmap, function(key, handler) {
        $(document).bind("keydown.keycmd", key, function(event) {
            handler.apply();
            event.stopPropagation();
            event.preventDefault();
        });
    });

    var treemap = {
        "alt+ctrl+l": function() {
            nodetree.cmdLayoutNodes();
        },
        "home": function() {
            nodetree.centreTree();
        },
        "ctrl+a": function() {
            nodetree.selectAll();
        },
        "del": function() {
            nodetree.cmdDeleteSelected();
        },
    };

    var viewcmdmap = {
        "home": function() {
            sdviewer.goHome();
        },
    };

    function bindScopedCmdMap(element, map, ns) {
        $(document).unbind("." + ns);
        $(element).bind("mouseenter", function(event) {
            $.each(map, function(key, handler) {
                $(document).bind("keydown." + ns, key, function(event) {
                    handler.apply();
                    event.stopPropagation();
                    event.preventDefault();
                });
            });
        }).bind("mouseleave", function(event) {
            $(document).unbind("." + ns);
        });
    }

    bindScopedCmdMap($("#node_canvas"), treemap, "treecmd");
    bindScopedCmdMap($("#imageviewer"), viewcmdmap, "viewercmd");

    $("#save_task_preset").click(function(event) {
        $("#task_update_script").val(
           JSON.stringify(nodetree.buildScript(), null, '\t'));
        $("#task_update_form").submit();
    });
    $("#cancel_task_preset").click(function(event) {
        $("#task_update_script").val("");
        $("#task_update_form").submit();
    });

    var hlcolors = {
        lines: ["rgba(255,34,34,0.2)", "rgba(255,34,34,0.1)"],
        paragraphs: ["rgba(34,34,255,0.2)", "rgba(34,34,255,0.1)"],
        columns: ["rgba(255,255,34,0.2)", "rgba(255,255,34,0.1)"],
    };

    // initialise the uploaders...
    uploader = new OcrJs.AjaxUploader(
        null,
        "/presets/upload/",
        { multi: false, errorhandler: OcrJs.ajaxErrorHandler, }
    );

    draguploader = new OcrJs.AjaxUploader(
            $("#node_canvas").get(0), 
            "/presets/upload/", {
                fakeinput: false,
                mimetypes: ["*"],
            });

    draguploader.addListeners({
        hoverOver: function() {
            $("#node_canvas").addClass("dragover");    
        },
        hoverOut: function() {
            $("#node_canvas").removeClass("dragover");    
        },
        drop: function() {
            $("#node_canvas").removeClass("dragover");    
        },
        uploading: function() {
            cmdstack.beginMacro("Drag drop node");
            statusbar.setWorking(true);
        },
        complete: function() {
            statusbar.setWorking(false);
            cmdstack.endMacro();
        },
        uploadResult: function(data, filename, filetype, event, count) {
            // FIXME: This stuff needs to be rationalised and moved
            // to somewhere more appropriate... i.e. composed of the
            // functions already in Nodetree.Tree for getting the
            // canvas point from a mouse point
            var data = JSON.parse(data.target.response);
            var type = "util.TextFileIn";
            if (filetype.search("image") != -1)
                type = "ocropus.GrayFileIn";
            var atpoint = SvgHelper.mouseCoord($("#node_canvas").get(0), event);
            var scale = SvgHelper.getScale(nodetree.group());
            nodetree.cmdCreateNode(filename, type, {
                x: ((atpoint.x - SvgHelper.getTranslate(nodetree.group()).x) + (count * 160)) / scale,
                y: (atpoint.y - SvgHelper.getTranslate(nodetree.group()).y) / scale,
            });
            var node = nodetree.getNode(filename);
            node.setParameter("path", data.file, true);
            nodetree.setNodeViewing(node);
        },
    });
    

    // save state on leaving the page... at least try to...
    window.onbeforeunload = function(event) {
        try {
            if (!$("#page_pid").val())
                statemanager.saveCookieData();
        } catch (msg) {
            alert(msg);
        }
    }

    $("#widget").tabs({
        select: function(event, ui) {
            sdviewer.refresh();
        },
    });

    $("#stop_refresh").click(function() {
        if (reshandler.isPending()) {
            reshandler.abort();
        } else {
            runScript();
            //stackChanged();
        }
        event.stopPropagation();
        event.preventDefault();
    });

    $("#optionsform").submit(function(event) {
        //nodetree.scriptChanged();
        console.log("OPTIONS FORM SUBMITTED!!!");
        return false;
        event.stopPropagation();
        event.preventDefault();
    });

    function clearNodeCache(node, donefunc) {
        resultcache = {};
        $.ajax({
            url: "/presets/clear_node_cache/",
            data: {
                node: node.name,
                script: JSON.stringify(nodetree.buildScript()),
            },
            type: "POST",
            dataType: "JSON",
            error: OcrJs.ajaxErrorHandler,
            success: function(data) {
                if (data && data.ok)
                    donefunc(node);
                else
                    console.error("Unexpect result on cache clear", data);
            },
        });
        event.preventDefault();
        event.stopPropagation();
    }

    function highlightComponents(data) {
        var overlays = {};
        $.each(["columns", "paragraphs", "lines"], function(i, klass) {
            if (data[klass]) {
                var colors = hlcolors[klass];
                $.each(data[klass], function(i, box) {
                    sdviewer.addHighlight(
                        new DziViewer.Rect(box[0], box[1], box[2], box[3]),
                            colors[0], colors[1]);
                });
            }
        });
        sdviewer.update();
    }

    function handleValidationError(errors) {
        $.each(errors, function(node, error) {
            nodetree.setNodeErrored(node, error);
        });
        // clear the client-size cache
        resultcache = {};
    }

    function handleResult(nodename, result, cached) {
        if (!result || !result.type) {
            console.error("Unexpected process result: ", result);
            return;
        }

        if (result.type == "error") {
            console.log("NODE ERROR: ", result.node, result.error);
            nodetree.setNodeErrored(result.node, result.error);
            return;
        }

        // otherwise cache the result and handle it
        var node = nodetree.getNode(nodename);
        if (!cached) {
            if (node) {
                var hash = hex_md5(bencode(node.hashValue()));
                resultcache[hash] = result;
            }
        }

        if (result.type == "image" || result.type == "pseg") {
            console.log("Setting data", result);
            sdviewer.clearHighlights();

            // if we're viewing the current node && there's an active GUI on it, 
            // and that GUI has a viewinput flag
            var havecurrentgui = guimanager.hasCurrent()
                    && guimanager.currentNode() == node
                        && guimanager.currentGui().viewinput;

            if (result.type == "pseg" || havecurrentgui) {
                sdviewer.openDzi(result.input);
                sdviewer.output = result.outout;
            } else {
                sdviewer.openDzi(result.output);
            }
            guimanager.refreshGui();
            
            if (result.type == "pseg") {
                highlightComponents(result);
            }
           // sdviewer.setBufferOverlays(overlays, 0);
            $("#widget").tabs("select", 0);
        } else if (result.type == "hocr") {
            hocrviewer.setData(result.data);
            $("#widget").tabs("select", 1);
            $("input[name='format']:checked").click();
        } else if (result.type == "text") {
            textviewer.setData(result.data);
            $("#widget").tabs("select", 2);
        } else {
            throw "Unknown result type: " + result.type;
        }
    }

    function runScript() {
        if (nodetree.hasNodes()) {
            var nodename = nodetree.getEvalNode();
            var node = nodetree.getNode(nodename);
            if (node) {
                var hash = hex_md5(bencode(node.hashValue()));
                console.log("Hash for node", node.name, hash);
                if (resultcache[hash]) {
                    console.log("Found cached result for:", nodename);
                    handleResult(nodename, resultcache[hash], true);
                } else {
                    reshandler.run("/presets/run/", {
                        script: JSON.stringify(nodetree.buildScript()),
                        node: nodename,
                    }, {
                        node: nodename,    
                    });
                }
            }
        }
    }


    // Initialise objects
    sdviewer = new DziViewer.Viewer($("#imageviewer_1").get(0), {
        numBuffers: 2,
        dashboard: false,
    });
    statusbar = new OcrJs.StatusBar($("#status_bar").get(0));
    hocrviewer = new OcrJs.HocrViewer($("#hocrviewer_1").get(0));
    textviewer = new OcrJs.TextViewer($("#textviewer_1").get(0));
    reshandler = new OcrJs.TaskWatcher(200);
    formatter = new OcrJs.LineFormatter();
    cmdstack = new OcrJs.UndoStack(this, {max: 50});
    nodetree = new OcrJs.Nodetree.Tree($("#node_canvas"), cmdstack);
    guimanager = new OcrJs.Nodetree.GuiManager(sdviewer);
    nodeparams = new OcrJs.Nodetree.Parameters($("#parameters").get(0));
    nodemenu = new OcrJs.Nodetree.ContextMenu($("#body").get(0), $("#node_canvas").get(0));
    statemanager = new OcrJs.Nodetree.StateManager($("#current_preset_name").get(0), nodetree);
    presetmanager = new OcrJs.PresetManager($("#script_toolbar").get(0), statemanager);

    statusbar.addListeners({
        cancel: function() {
            reshandler.abort();
        },
    });

    var UPDATE = true;

    presetmanager.addListeners({
        openPreset: function() {
            reshandler.abort();
            statusbar.setWorking(false);
        },
        newPreset: function() {
            reshandler.abort();
            statusbar.setWorking(false);
            textviewer.clearData();
            hocrviewer.clearData();
            sdviewer.close();
            nodeparams.resetParams();
            guimanager.tearDownGui();
        },
    });

    statemanager.addListeners({
        opened: function(name) {
            $("#current_preset_name").text(name);
            $("#preset_unsaved").toggle(statemanager.isDirty());
        },
        cleared: function() {
            $("#current_preset_name").text(statemanager.getCurrentName());
            $("#preset_unsaved").hide();
        },
    });

    reshandler.addListeners({
        start: function() {
            $("#stop_refresh").button({
                text: false,
                icons: {
                    primary: "ui-icon-cancel",
                }
            });
            //showPending();
            nodetree.clearErrors();
            statusbar.setWorking(true);
        },
        done: function(data, meta) {
            $("#stop_refresh").button({
                text: false,
                icons: {
                    primary: "ui-icon-refresh",
                }
            });
            statusbar.setWorking(false);
            nodetree.clearErrors();
            if (data.status == "NOSCRIPT")
                console.log("Server said 'Nothing to do'")
            else if (data.status == "VALIDATION") {
                handleValidationError(data.errors);
            } else {
                if (data.status != "ABORT" && data.status != "FAILURE")
                   handleResult(meta.node, data.results, false);
            }

        },
        error: function(msg) {
            statusbar.setWorking(false);
            alert(msg);
        },
    });

    function stackChanged() {
        if (UPDATE) {
            $("#undo_command")
                .text(cmdstack.undoText())
                .button({disabled: !cmdstack.canUndo()})
                .button("refresh");
            $("#redo_command")
                .text(cmdstack.redoText())
                .button({disabled: !cmdstack.canRedo()})
                .button("refresh");
            $("#preset_unsaved").toggle(statemanager.isDirty());

            guimanager.refreshGui();
            runScript();
        } else {
            console.log("Stack changed but not updating", cmdstack.index);
        }
        nodeparams.resetParams(nodetree.getFocussedNode());
        //cmdstack.debug();
    };

    nodeparams.addListeners({
        parameterSet: function(node, paramname, value) {
            nodetree.cmdSetNodeParameter(node, paramname, value);
        },
        registerUploader: function(name, elem) {
            uploader.removeListeners("uploadResult.setfilepath");
            uploader.setTarget(elem);
            // FIXME: No error handling
            uploader.addListener("uploadResult.setfilepath", function(data) {
                nodetree.cmdSetNodeParameter(nodetree.getNode(name), "path",
                    JSON.parse(data.target.response).file);
            });
        },
        renamedNode: function(node, name) {
            if (nodetree.isValidNodeName(name, node.name)) {
                nodetree.renameNode(node, name);
                nodeparams.setNodeNameValid();
            } else {
                nodeparams.setNodeNameInvalid();
            }
        },
    });

    guimanager.addListeners({
        parametersSet: function(node, paramvals) {
            nodetree.cmdSetMultipleNodeParameters(node, paramvals);
        },
        interacting: function(bool) {
            UPDATE = !bool;
            stackChanged();
        },
    });

    nodemenu.addListeners({
        newNodeClicked: function(event, typename, context) {
            nodetree.createNodeWithContextFromEvent(typename, event, context);
        },
        nodeDelete: function(node) {
            if (node.isFocussed())
                nodetree.cmdDeleteSelected();
            else
                nodetree.cmdDeleteNode(node);
        },
        nodeRefresh: function(node) {
            clearNodeCache(node, function() {
                console.log("Cleared cache for", node.name);
            });
        },
    });

    cmdstack.addListeners({
        undoStateChanged: stackChanged,
        redoStateChanged: stackChanged,
        indexChanged: stackChanged,
        stateChanged: function() {
            nodeparams.resetParams(nodetree.getFocussedNode());
        },
    });

    // Set up events
    nodetree.addListeners({
        scriptChanged: function(what) {
            console.log("Script changed:", what);
        },
        nodeFocussed: function(node) {
            console.log("Node focussed!", node);
            if (!node) {
                //if (guimanager.hasCurrent()) {
                //    var cnode = guimanager.currentNode();
                //    var gui = guimanager.currentGui();
                //    if (gui.viewinput && cnode.output)
                //        sdviewer.openDzi(cnode.output);
                //}
                guimanager.tearDownGui();
            }else {
                if (sdviewer.isOpen()) {
                    console.log("Setting GUI for", node.name);
                    guimanager.setupGui(node);
                }
            }
            nodeparams.resetParams(node);
        },
        nodeViewing: function(node) {
            stackChanged();
        },
        ready: function() {
            // load state stored from last time
            if ($("#page_pid").val())
                statemanager.loadTaskData({
                    pid: $("#page_pid").val(),
                    page_name: $("#page_name").val(),
                    script: $("#page_script").val(),    
                });
            else
                statemanager.loadCookieData();
            var node = nodetree.getFocussedNode();
            if (!node)
                guimanager.tearDownGui();
            else {
                if (sdviewer.isOpen()) {
                    console.log("Setting GUI for", node.name);
                    guimanager.setupGui(node);
                }
            }
            nodeparams.resetParams(node);
        },
        clicked: function(event) {
            nodemenu.hideContextMenu();
        },
        rightClicked: function(event, context) {
            nodemenu.showContextMenu(event, context);
        },
    });

    layoutmanager.addListeners({
        layoutChanged: function() {
            nodetree.resetSize();
            sdviewer.resetSize();
        },
        initialised: function() {
            nodetree.resetSize();
            sdviewer.resetSize();
            // Initialise nodetree!
            $.ajax({
                url: "/presets/query/",
                success: function(data) {
                    nodetree.startup(data);
                    nodemenu.startup(data);
                },
                error: OcrJs.ajaxErrorHandler,
            });
        }
    });

});

