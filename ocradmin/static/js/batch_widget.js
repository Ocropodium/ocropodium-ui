// Replacement batch widget

OCRJS.BatchWidget2 = OCRJS.OcrBaseWidget.extend({
    constructor: function(parent, batch_id, options) {
        this.base(parent, options);
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
        this._

    },

    init: function() {
        var self = this;
        this.setupEvents();
        this.refreshTasks();
    },

    setupEvents: function() {
        var self = this;

        this._container.scroll(function(event) {
            self.triggerRefresh(100);            
        });

        this._tasks.bind("click", function(event) {
            var index = $(this).data("index");
            var pk = $(this).data("pk");
            if (!$(this).hasClass("current")) {
                $(".batch_task").removeClass("current");
                $(this).addClass("current");
                self.callListeners("onTaskSelected", index, pk);
            } else {
                $(this).removeClass("current");
                self.callListeners("onTaskDeselected", index, pk);
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
            var action = $(this).attr("title").toLowerCase();
            var pk = $(this).data("pk");
            if (pk == undefined)
                return false;                
            $.ajax({
                url: $(this).attr("href"),
                type: "POST",
                dataType: "json",
                beforeSend: function(e) {
                    if (!$(this).parent().hasClass("batch_task")) {
                        if (!confirm("Really " + action + "?"))
                            return false;
                    }
                    self.setTaskWaiting($(this).parent(), true);
                },
                error: OCRJS.ajaxErrorHandler,
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

        $(".toggle_button", this.parent).click(function(event) {
            $(".list_popup").toggle();
        });


        $(".filter_none").change(function(event) {
            $(".filter_type:checked").prop("checked", !$(this).prop("checked"));
            self.filterTasks();
        });

        $(".filter_type").click(function(event) {           
            $(".filter_none").prop("checked",  
                $(".filter_type:checked").length == 0);
            self.filterTasks();
        });

        $("#text_filter").keyup(function(event) {
            self.filterTasks();
        });
    },      

    filterTasks: function() {
        return this.triggerRefresh(0);                     
        var self = this;

        var textfilter = new RegExp($.trim($("#text_filter").val().toLowerCase()));
        var statuses = $(".filter_type:checked").map(function(i, elem) {
            return $(this).attr("name").replace(/^status_/, "");
        });
        var name, status;
        self._tasks.each(function(i, elem) {
            var inarr = $.inArray($(elem).data("status"), statuses); 
            if (statuses.length != 0)
                $(elem).toggle(inarr != -1);
            else
                $(elem).show();
            if ($(elem).is(":visible")) {            
                var name = $(elem).data("name");
                if (textfilter.source != "" && name)
                    $(elem).toggle(name.toLowerCase().match(textfilter) != null);
            }
        });
    },                 

    setTaskWaiting: function(task, waiting) {
        task.find(".progressbar_container").toggleClass("waiting", waiting);        
    },
    
    topVisibleTask: function(scroll) {
        var top = this._container.scrollTop(),
            margin = parseInt(this._tasks.css("marginBottom").replace(/px/, ""));
        return Math.floor(top / (this._tasks.outerHeight() + margin));
    },

    visibleTaskCount: function(scroll) {
        var windowheight = this._container.height(),
            tasks = $(".batch_task", scroll),
            margin = parseInt(this._tasks.css("marginBottom").replace(/px/, ""));
        return Math.ceil(windowheight / (this._tasks.outerHeight() + margin));
    },

    updateBatchData: function() {
        this.setProgressStatus(
                $("#batch" + this._batch_id), 
                this._batchdata.extras.estimate_progress);        
    },                      

    updateTaskData: function(from, to) {
        var self = this;                        
        var taskdata = self._batchdata.fields.tasks;
        var pk, progress, status, name;
        this._tasks.slice(from, to).each(function(i, elem) {
            pk = taskdata[i].pk, progress = taskdata[i].fields.progress,
                status = taskdata[i].fields.status,
                name = taskdata[i].fields.page_name;
            $(elem)
                .attr("id", "task" + taskdata[i].pk)
                .data("pk", pk)
                .data("status", status)
                .data("name", name)
                .removeClass("empty")
                .find(".page_name")
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
        });
    },

    refreshTasks: function() {
        var self = this;                      
        var first = Math.max(0, this.topVisibleTask() - 5)
            count = this.visibleTaskCount() + 10;
        $.ajax({
            url: "/batch/results/" + self._batch_id + "/",
            data: {
                start: first,
                limit: count,
            },
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


