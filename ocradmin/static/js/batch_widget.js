// Replacement batch widget

OcrJs.BatchWidget = OcrJs.Base.extend({
    init: function(parent, batch_id, options) {
        this._super(parent, options);
        this.options = {
            log: true,
        },
        $.extend(this.options, options);
        this._batch_id = batch_id;
        this._listeners = {
            onTaskSelected: [],
            onTaskDeselected: [],
            onUpdate: [],
        };

        this._refreshtimer = -1;
        this._polltime = 250;

        // reference some useful stuff
        this._container = $(".tl_container", parent);
        this._tasks = $(".batch_task", parent);
        this._taskcount = this._tasks.length;
        this._rowtemplate = $.template($("#row_template"));

    },

    startup: function() {
        var self = this;
        this.setupEvents();
        this.refreshTasks();
    },

    setupEvents: function() {
        var self = this;

        this._container.scroll(function(event) {
            if ($(".batch_task.empty").length > 0 || !self.isComplete())
                self.triggerRefresh(100);
        });

        this._tasks.bind("click", function(event) {
            var index = $(this).data("index");
            var pk = $(this).data("pk");
            if (!$(this).hasClass("current")) {
                $(".batch_task").removeClass("current");
                $(this).addClass("current");
                self.trigger("onTaskSelected", index, pk);
            } else {
                $(this).removeClass("current");
                self.trigger("onTaskDeselected", index, pk);
            }
        });
             
        $(".export_link", this.parent).click(function(event) {
            var dialog = $("<div></div>")
                .attr("id", "export_dialog")
                .load($(this).attr("href"), function(data) {
                    $("#tabs").tabs();
                    $("#submit_export_form").click(function(e) {
                        $("#export_dialog").dialog("close");
                    });
                })
                .dialog({
                    modal: true,
                    width: 600,
                    height: 600,
                    title: "Export Batch",
                    close: function(e, ui) {
                        $("#export_dialog").remove();
                    },
                });
            event.preventDefault();
            event.stopPropagation();
        });

        $(".ui-icon", this.parent).bind("mouseover mouseout", function(event) {
            if (event.type == "mouseover") {
                $(this).addClass("ui-state-hover");
            } else {
                $(this).removeClass("ui-state-hover");
            }
        });

        $(".retry_task, .abort_task, .retry_batch, .retry_errored, .abort_batch")
                .click(function(event) {
            var elem = this;
            var action = $(this).attr("title").toLowerCase();
            var pk = $(this).data("pk");
            if (pk == undefined)
                return false;
            $.ajax({
                url: $(this).attr("href"),
                type: "POST",
                dataType: "json",
                beforeSend: function(e) {
                    if (!$(elem).parent().hasClass("batch_task")) {
                        if (!confirm("Really " + action + "?"))
                            return false;
                    }
                    self.setTaskWaiting($(this).parent(), true);
                },
                error: OcrJs.ajaxErrorHandler,
                complete: function(e) {
                    self.setTaskWaiting($(this).parent(), false);
                },
                success: function(data) {
                    if (data.ok) {
                        self.refreshTasks();
                    }
                },
            });
            event.preventDefault();
            event.stopPropagation();
        });

        $("#status_filter", this.parent).click(function(event) {
            $(".list_popup").css({
                position: "fixed",
                left: $(this).offset().left,
                top: $(this).offset().top + $(this).outerHeight(),
            }).toggle();
        });


        $(".filter_none").change(function(event) {
            $(".filter_type:checked").prop("checked", !$(this).prop("checked"));
            if ($(".filter_type:checked").length == 0 && !$(this).prop("checked"))
                $(this).prop("checked", true);
            else
                self.triggerRefresh(1);
        });

        $(".filter_type").click(function(event) {
            $(".filter_none").prop("checked",
                $(".filter_type:checked").length == 0);
            self.triggerRefresh(1);
        });

        $("#text_filter").keyup(function(event) {
            $(".toggle_button").toggleClass("filtered", self.isFiltered());
            self.triggerRefresh(50);
        });

        $(".filter_none, .filter_type").change(function(event) {
            $(".toggle_button").toggleClass("filtered", self.isFiltered());
        });
    },

    resetSize: function() {
        // FIXME: Need to determine correct
        // css margin.  For the moment, assume
        // top and bottom margin are each 10px,
        // so outer is 20px
        this._container
            .css(
                "height",
                this._container.height()
            );
    },

    isFiltered: function() {
        return !($(".filter_type:checked").length == 0
                        && $.trim($("#text_filter").val()) == "");
    },

    setTaskWaiting: function(task, waiting) {
        task.find(".progressbar_container").toggleClass("waiting", waiting);
    },
    
    topVisibleTask: function(scroll) {
        if (this._tasks.length == 0)
            return 0;
        var top = this._container.scrollTop(),
            margin = parseInt(this._tasks.css("marginBottom").replace(/px/, ""));
        return Math.floor(top / (this._tasks.outerHeight() + margin));
    },

    visibleTaskCount: function(scroll) {
        if (this._tasks.length < 10)
            return 50;
        var windowheight = this._container.height(),
            tasks = $(".batch_task", scroll),
            margin = parseInt(this._tasks.css("marginBottom").replace(/px/, ""));
        return Math.ceil(windowheight / (this._tasks.outerHeight() + margin));
    },

    updateBatchData: function() {
        this.setProgressStatus(
                $("#batch"),
                this._batchdata.extras.estimate_progress);
    },

    updateTaskData: function(from, to) {
        var self = this;
        var taskdata = self._batchdata.fields.tasks;

        // if we don't have the same amount of tasks
        // we need to reset the whole widget
        if (self._batchdata.extras.task_count != this._taskcount) {
            this._taskcount = self._batchdata.extras.task_count;
            this.reinitialiseRowData(taskdata);
        }

        to = Math.min(to, this._taskcount);
        var pk, progress, status, name;
        this._tasks.slice(from, to).each(function(i, elem) {
            // FIXME: Find out why we occasionally get null data here...
            // it shouldn't really happen...
            if (taskdata[i]) {
                pk = taskdata[i].pk, progress = taskdata[i].fields.progress,
                    status = taskdata[i].fields.status,
                    name = taskdata[i].fields.page_name;
                $(elem)
                    .attr("id", "task" + pk)
                    .data("pk", pk)
                    .data("status", status)
                    .data("name", name)
                    .removeClass("empty")
                    .find(".page_name")
                    .attr("href", "/documents/edit/" + name + "/")
                    .text(name)
                    .end()
                    .find(".page_info")
                    .text("Lines: " + taskdata[i].fields.lines)
                    .end()
                    .find(".retry_task")
                    .data("pk", pk)
                    .attr("href", "/ocrtasks/retry/" + pk + "/")
                    .end()
                    .find(".abort_task")
                    .attr("href", "/ocrtasks/abort/" + pk + "/")
                    .data("pk", pk)
                    .end()
                    .find(".progress")
                    .css("width", progress + "%")
                    .attr("title", progress + "%")
                    .end();
                self.setProgressStatus($(elem), progress, status);
            }
        });
    },

    reinitialiseRowData: function(taskdata) {
        if (this._tasks.length < this._taskcount) {
            for (var i = this._tasks.length; i < this._taskcount; i++) {
                var row = $.tmpl(this._rowtemplate, {
                    index: i
                });
                console.log(row);
                $(".task_list", this._container).append(row);
            }
        } else
            this._tasks.slice(this._taskcount, this._tasks.length).remove();
        this._tasks = $(".batch_task", this._container);
    },

    refreshTasks: function() {
        var self = this;
        var first = Math.max(0, this.topVisibleTask() - 5)
            count = this.visibleTaskCount() + 10;
        var statuses = $(".filter_type").filter(function(i, e) {
                return $(e).prop("checked");
        }).map(function(i, e) {
            return "status=" + $(e).attr("name").replace(/status_/, "")
        }).toArray().join("&");
        var data = {start: first, limit: count};
        if ($.trim($("#text_filter").val()))
            data["name"] = $.trim($("#text_filter").val());
        $.ajax({
            url: "/batch/results/" + self._batch_id + "/?" + statuses,
            data: data,
            beforeSend: function() {
                self._tasks.slice(first, first + count)
                    .filter(".empty")
                    .addClass("loading");
            },
            success: function(data) {
                self._batchdata = data[0];
                self.updateBatchData();
                self.updateTaskData(first, first + count);
                if (!self.isComplete())
                    self.triggerRefresh();
            },
            complete: function() {
                self._tasks.removeClass("loading");
            }

        });
    },

    triggerRefresh: function(delay) {
        var self = this;
        var delay = delay || this._polltime;
        if (this._refreshtimer != -1)
            clearTimeout(this._refreshtimer);
        this._refreshtimer = setTimeout(function() {
            self.refreshTasks();
        }, delay);
    },

    setProgressStatus: function(task, progress, status) {
        var progstr = Math.round(progress) + "%";
        if (status == "FAILURE")
            progstr = "100%";
        task.find(".progress").css("width", progstr).attr("title", progstr);
        if (status) {
            task.find(".progressbar").attr("class", "progressbar " + status.toLowerCase());
        } else if (progress > 99.5) {
            task.find(".progressbar").attr("class", "progressbar success");
        } else {
            task.find(".progressbar").attr("class", "progressbar started");
        }
    },
                    
    // check whether all tasks are complete
    isComplete: function() {
        return this._batchdata.extras.is_complete;
    },

});


