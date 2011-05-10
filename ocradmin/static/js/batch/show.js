var batch = null;
$(function() {

    var sideparams = null;
    var selectedtab = $.cookie("selectedtab") || 0;
    var sidebar = $("#sidebar_content");
    var header = $(".widget_header", $("#sidebar"));

    //$(".recent_batch_link").live("click", function(event) {
    //    batch.setBatchId($(this).data("pk"));    
    //    event.preventDefault();
    //});

    function loadBatchList() {
        $.ajax({
            url: "/batch/list?order_by=-created_on",
            data: {},
            dataType: "json",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                populateBatchList(data);
                header.text("Recent Batches");
            },
        });
    }

    function populateBatchList(data) {
        var list = $("<div></div>").addClass("recent_batches");
        var tbatch = $("<div></div>").addClass("recent_batch");
        var titem = $("<span></span>"); 
        var tlink = $("<a></a>").addClass("recent_batch_link");
        var ttran = $("<a></a>").addClass("button");
        $.each(data.object_list, function(i, batch) {
            var span = titem.clone();
            var link = tlink.clone()
                .attr("href", "/batch/show/" + batch.pk + "/")
                .data("pk", batch.pk)
                .text(batch.fields.name);
            var trans = ttran.clone()
                .attr("href", "/batch/transcript/" + batch.pk + "/")
                .css("float", "right")
                .data("pk", batch.pk)
                .text("Transcript");
            list
                .append(tbatch.clone().append(span.append(trans).append(link)))
                .textOverflow("...");        
        });
        sidebar.html(list);
    }

    function hashNavigate() {
        if (document.location.hash.match(/^(#task(\d+))/)) {
            var taskid = RegExp.$1;
            var taskpk = RegExp.$2;
            var sel = $(taskid);
            var pk = sidebar.data("task_pk");
            if (sel.length && pk != taskpk)
                sel.click();
        }
    }


    function loadTaskDetails(index, pk) {
        $.ajax({
            url: "/ocrtasks/show/" + pk + "/",
            type: "get",
            success: function(data) {
                var html = $(data);
                sidebar.data("task_pk", pk);
                var loaded = false;
                $.getJSON("/ocr/task_config/" + pk + "/", function(data) {
                    sideparams = new OCRJS.ParameterBuilder(
                            html.find("#options").get(0), data);
                    sideparams.addListeners({
                        onReadyState: function() {
                            if (!loaded) {
                                sidebar.html(html);
                                console.log("Active: ", selectedtab);
                                sidebar.find("#tabs")
                                    .accordion({
                                        collapsible: true,
                                        autoHeight: false,
                                        active: parseInt(selectedtab),
                                        change: function(event, ui) {
                                            selectedtab = ui.options.active;
                                            $.cookie("selectedtab", selectedtab); 
                                        },
                                    });
                                loaded = true;
                                header.text("Task #" + pk);
                            }
                            $(".submit_update", sidebar).attr("disabled", false);
                        },
                        onUpdateStarted: function() {
                            $(".submit_update", sidebar).attr("disabled", true);
                        }
                    });
                    sideparams.init();
                });
            },
        });
    }

    var scrolltimer = -1;

    $("#batchcontainer").resizable({
        minHeight: $("#batchcontainer").height() - $(".tl_container", this).height(),
        resize: function(event, ui) {
            var outer = $(this), inner = $(".tl_container", this);
            var possdiff = inner.offset().top - (outer.offset().top
                    - outer.css("marginTop").replace(/px/, ""));
            inner.outerHeight(outer.height() - possdiff);
            refreshTasks($(".tl_container", this));
        }        
    });

    function topVisibleTask(scroll) {
        var top = $(scroll).scrollTop(),
            tasks = $(".batch_task", scroll),
            margin = parseInt(tasks.css("marginBottom").replace(/px/, ""));
        return Math.floor(top / (tasks.outerHeight() + margin));
    }

    function visibleTaskCount(scroll) {
        var windowheight = $(scroll).height(),
            tasks = $(".batch_task", scroll),
            margin = parseInt(tasks.css("marginBottom").replace(/px/, ""));
        return Math.ceil(windowheight / (tasks.outerHeight() + margin));
    }

    function updateTaskData(data, from, to) {
        var taskdata = data.fields.tasks;
        $(".batch_task").slice(from, to).each(function(i, elem) {
            $(elem)
                .attr("id", "task" + taskdata[i].pk)
                .find(".page_name")
                .text(taskdata[i].fields.page_name)
                .end()
                .find(".page_info")
                .text("Lines: " + taskdata[i].fields.lines)
                .end()
                .find(".retry_task")
                .attr("href", "/ocrtasks/retry/" + taskdata[i].pk + "/")
                .end()
                .find(".abort_task")
                .attr("href", "/ocrtasks/abort/" + taskdata[i].pk + "/")
                .end()
                .find(".progress")
                .css("width", taskdata[i].fields.progress + "%")
                .attr("title", taskdata[i].fields.progress + "%")
                .end();
                
        });
    }

    function refreshTasks(scroll) {
        var pk = $("#ocr_batch").data("index");
        var first = Math.max(0, topVisibleTask(scroll) - 5)
            count = visibleTaskCount(scroll) + 10;
        var data = {
            start: first,
            limit: count,
        };
        $.ajax({
            url: "/batch/results/" + pk + "/",
            data: data,
            beforeSend: function() {
                $(".batch_task").slice(first, first + count)
                    .addClass("loading");
            },
            success: function(data) {
                var data = data[0];
                console.log(data);
                updateTaskData(data, first, first + count);
            },
            complete: function() {
                $(".batch_task").removeClass("loading");
            }

        });
    }

    function triggerRefresh(scroll) {
        if (scrolltimer != -1)
            clearTimeout(scrolltimer);
        scrolltimer = setTimeout(function() {
            refreshTasks(scroll);
        }, 100);
    }

    refreshTasks($(".tl_container").get(0));

    $(".tl_container").scroll(function(event) {
        triggerRefresh(this);            
    });

    if ($("#batch_id").length) {
        var type = $("#batch_type").val();
        var widget;
        switch (type) {
            case "compare.groundtruth":
                widget = OCRJS.ComparisonWidget;
                break;
            case "fedora.ingest":
                widget = OCRJS.ExportWidget;
                break;
            default:
                widget = OCRJS.BatchWidget2;
        }
        //batch = new widget($("#workspace").get(0), $("#batch_id").val());
        //batch.addListeners({
        //    onTaskSelected: loadTaskDetails,
        //    onTaskDeselected: function() {
        //        loadBatchList();
        //    },
        //    onUpdate: hashNavigate,                                
        //}).init();

        window.addEventListener("hashchange", function() {
            //hashNavigate();
        });

        $(".submit_update").live("click", function(event) {
            var button = $(this);
            button.attr("disabled", true);
            var pk = sidebar.data("task_pk");
            if (!pk)
                return;
            $.ajax({
                url: "/ocr/update_task/" + pk + "/",
                type: "post",
                data: sideparams.serializedData(),
                success: function(resp) {
                    $(button).attr("disabled", false);
                    if (button.attr("id").search("rerun") != -1) {
                        $.post("/ocrtasks/retry/" + pk + "/");
                        batch.pollForResults();
                    }
                },                                
            });
            return false;
        });
    
        if (document.location.hash.match(/^(#task(\d+))/)) {
            var selector = RegExp.$1;
            console.log("Selecting")
            $(selector).click();                        
        } else {
            loadBatchList();
        }
    }
});        


