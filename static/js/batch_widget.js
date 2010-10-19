// Widget representing a single OCR batch.  Displays a lazy
// loading scrollable list of tasks which can be filtered 
// and individually restarted/aborted.



OCRJS.BatchWidget = OCRJS.OcrBaseWidget.extend({
    constructor: function(parent, batch_id, initial, options) {
        this.base(parent, options);
        this.options = {
            log: true,
        },
        $.extend(this.options, options);

        this._batch_id = batch_id;

        // time to recheck running tasks
        this._polltime = 500; 

        // max number of tasks to load
        this._maxtasks = 15;

        // start of first loaded task
        this._taskoffset = 0;

        // cache of data, initially empty
        this._batchdata = null;

        // store the id for the next timeout
        this._polltimeout = -1;

        // status filter widget
        this._statusfilter = new MultiFilterList(
            "status",
            ["INIT", "PENDING", "RETRY", "STARTED", "SUCCESS", "ERROR", "ABORTED"],
            true
        );
    },

    init: function() {
        // UI bits it's useful to keep a reference to:
        this._container = $("<div></div>")
            .addClass("widget");  
        this._header = $("<div></div>")
            .addClass("batch_head")
            .addClass("widget_header")
            .attr("id", "batch_head")
            .text("OCR Batch");
        this._batchdiv = $("<div></div>")
            .addClass("ocr_batch")
            .addClass("waiting")
            .attr("id", "ocr_batch");
        this._tasklist = $("<div></div>")
            .addClass("task_list");

        this._scrollwin = $("<span></span>")
            .addClass("scroll_viewer")
            .attr("id", "scroll_viewer");
        this._button_template = $("<a></a>")
            .attr("href", "#")
            .addClass("ui-state-default")
            .addClass("ui-corner-all")
            .addClass("button_link")
            .addClass("ui-icon");

        this._batch_buttons = [ {
                title: "Retry Errored Tasks",
                classes: "ui-icon-refresh retry_errored",
            }, {
                title: "Retry All Tasks",
                classes: "ui-icon-refresh retry_batch",
            }, {
                title: "Abort Entire Batch",
                classes: "ui-icon-circle-close retry_batch",
            },
        ];

        this._task_buttons = [ {
                title: "Retry Task",
                classes: "ui-icon-refresh retry_task",
            }, {
                title: "Abort Task",
                classes: "ui-icon-circle-close abort_task",
            }, {
                title: "Show Task Info",
                classes: "ui-icon-info task_info",
            },
        ];

        this._createBatchHeaderUi();    
        this._createTaskListUi();
        this._container
            .append(this._header)
            .append(this._batchdiv)
            .appendTo(this.parent);
        $(".batch_task").disallowSelection();
        this.setupMouseEvents();
        this.manualRefresh();
      
    },

    setupMouseEvents: function() {
        var self = this;

        $(".batch_task").bind("dblclick", function(event) {
            var index = $(this).data("index");
            var batchclass = self.getBatchClass(self._batchdata.fields.task_type);
            if (batchclass == "compare") {
                document.location.href = "/training/comparison?batch=" + 
                    self._batchdata.pk;
            } else if (batchclass == "fedora") {

            } else {
                document.location.href = "/batch/transcript/" + self._batchdata.pk
                + "/?page=" + (index + self._taskoffset);
            }
        });

        $(".batch_task").bind("click", function(event) {
            return false;
        });

        $(".ui-icon").bind("mouseover mouseout", function(event) {
            if (event.type == "mouseover") {
                $(this).addClass("ui-state-hover");
            } else {
                $(this).removeClass("ui-state-hover");
            }
        });


        $(".retry_task").bind("click", function(event) {
            var pk = $(this).data("pk");
            $.ajax({
                url: "/batch/retry_task/" + pk + "/",
                type: "POST",
                dataType: "json",
                beforeSend: function(e) { 
                    self.setTaskWaiting($("#task" + pk), true);
                },
                error: function(e, msg) {
                    alert(msg);
                },
                complete: function(e) {
                    self.setTaskWaiting($("#task" + pk), false);
                },
                success: function(data) {
                    if (data.ok) {
                        self.refreshUnlessPolling();
                    }
                },
            });
            event.preventDefault();    
        });


        $(".task_info").bind("click", function(event) {
            var pk = $(this).data("pk");
            $("#dialog_box").dialog({
                    modal: true,
                    title: "Task Details",
                    width: 700,
                    height: 500,
                    close: function(e, ui) {
                        $(this).html();
                    },
                });
            $.ajax({
                url: "/ocrtasks/show/" + pk + "/",
                type: "GET",
                dataType: "html",
                error: function(e, msg) {
                    alert(msg);
                },
                success: function(data) {
                    $("#dialog_box").html(data)                    
                        .find("#tabs")
                        .tabs();
                },
            });
            event.preventDefault();    
        });


        $(".abort_task").bind("click", function(event) {
            var pk = $(this).data("pk");
            $.ajax({
                url: "/batch/abort_task/" + pk + "/",
                type: "POST",
                dataType: "json",
                beforeSend: function(e) {                
                    self.setTaskWaiting($("#task" + pk), true);
                },
                error: function(e, msg) {
                    alert(msg);
                },
                complete: function(e) {
                    self.setTaskWaiting($("#task" + pk), false);
                },
                success: function(data) {
                    if (data.ok) {
                    } 
                    self.refreshUnlessPolling();
                },
            });
            event.preventDefault();    
        });


        // scroll up and down via buttons
        $("#scrolldown").bind("click", function(event) {
            self.scrollDown(event);
        });
        $("#scrollup").bind("click", function(event) {
            self.scrollUp(event);
        });

        this._statusfilter.onChange = function() {
            self.refreshUnlessPolling();
        }


        $(".retry_batch, .retry_errored, .abort_batch").bind("click", function(event) {
            var pk = $(this).data("pk");
            var action = $(this).attr("title").toLowerCase();
            $.ajax({
                url: $(this).attr("href"),
                type: "POST",
                dataType: "json",
                error: function(e, msg) {
                    alert(msg);
                },
                beforeSend: function(e) {
                    if (!confirm("Really " + action + "?"))
                        return false;
                    self.setTaskWaiting($("#batch" + pk), true);
                },
                complete: function(e) {
                    self.setTaskWaiting($("#batch" + pk), false);
                },
                success: function(data) {
                    if (data.ok) {
                    }
                    self.refreshUnlessPolling();
                },
            });
            event.preventDefault();   
            event.stopPropagation(); 
        });
    },


    setupKeyEvents: function() {
        var self = this;

    },                 

    teardownKeyEvents: function() {
    
    },                 

    container: function() {
        return this.containerWidget();
    },


    setBatchId: function(batch_id) {
        this._taskoffset = 0;
        this._batch_id = batch_id;
        this.refreshUnlessPolling();
    },

    // handle the results of each poll - we should
    // get back an array containing only one element
    // (due to the way django serializes our query
    processData: function(data) {
        if (data.error) {
            alert(data.error + "\n\n" +  data.trace);
        } else {
            this._batchdata = data[0];
            this.updateResults(this._batchdata);
            return this.isComplete(); 
        }
        return true;
    },


    // check the server for complete results...
    pollForResults: function(polltime) {
        var self = this;                        
        params = "start=" + this._taskoffset + "&limit=" + this._maxtasks;
        $.each(this._statusfilter.value(), function(i, val) {
            params += "&status=" + val;
        });
        $.ajax({
            url: "/batch/results/" + this._batch_id,
            data: params,
            type: "GET",
            dataType: "json",
            beforeSend: function() {
                self.setWaiting(true);
            },
            success: function(data) {
                if (!self.processData(data)) {
                    self._polltimeout = setTimeout(function() {
                        self.pollForResults(polltime);
                    }, polltime);
                } else {
                    self._polltimeout = -1;
                }                
            },
            error: function(xhr, statusText, errorThrown) {
                alert("Http Error " + statusText + "\n\n" + errorThrown);
            },
            complete: function() {
                self.setWaiting(false);
            },
        }); 
    },

    // refresh immediately - cancel the next poll
    // and start a new one if necessary
    manualRefresh: function() {
        if (this._polltimeout != -1) {
            clearTimeout(this._polltimeout);
        }
        this.pollForResults(this._polltime)
    },

    setBatchResults: function(batchdata) {
        var batchclass = this.getBatchClass(this._batchdata.fields.task_type);
        var batch = this._batchdiv.find(".batch");
        batch.attr("id", "batch" + batchdata.pk)
        batch.find(".batch_header").attr("class", "batch_header " + batchclass);

        // set titles
        batch
            .find(".batch_name")
            .text(batchdata.fields.name)
        var link = batch
            .find(".transcript_link");
        if (batchclass == "compare") {
            link
                .attr("href", "/training/comparison?batch=" + batchdata.pk)
                .text("Comparison Results");
        } else if (batchclass == "fedora") {

        } else {
            link
                .attr("href", "/batch/transcript/" + batchdata.pk + "/")
                .text("View Transcripts")
        }

        // update links with the batch id
        batch.find(".retry_batch")
            .attr("href", "/batch/retry/" + batchdata.pk + "/") 
            .data("pk", batchdata.pk);
        batch.find(".retry_errored")
            .attr("href", "/batch/retry_errored/" + batchdata.pk + "/") 
            .data("pk", batchdata.pk);
        batch.find(".abort_batch")
            .attr("href", "/batch/abort_batch/" + batchdata.pk + "/") 
            .data("pk", batchdata.pk);
        this.setProgressStatus(batch, batchdata.extras.estimate_progress);
    },


    // add results to the page.
    updateResults: function(batchdata) {

        this.setWaiting(false);
        this.setBatchResults(batchdata);

        for (var i = 0; i < this._maxtasks; i++) {
            var taskdata = batchdata.fields.tasks[i];
            var task = this._tasklist.find(".batch_task").slice(i);
            // hide the task if we've run out of data - this happens
            // if there are less than m_maxtasks tasks in the set.
            if (taskdata == null) {
                task.hide()
                    .attr("id", null)
                    .find("a")
                    .removeData()
                    .attr("href", "#")
                    .end()
                    .find("page_name")
                    .text("");
                continue;                
            }

            task.attr("id", "task" + taskdata.pk)
                .data("pk", taskdata.pk)
                .data("index", i);
            task.find(".page_name")
                .text(taskdata.fields.page_name);
            task.find("a").data("pk", taskdata.pk);
            task.find(".retry_task")
                .attr("href", "/batch/retry_task/" + taskdata.pk + "/");
            task.find(".abort_task")
                .attr("href", "/batch/abort_task/" + taskdata.pk + "/");
            this.setProgressStatus(task, taskdata.fields.progress, taskdata.fields.status);
            if (taskdata.fields.lines != null) {
                task.find(".page_info").text("Lines: " + taskdata.fields.lines);
            }
            task.show()
        }

        this.setScrollHandleHeight();
    },


    setProgressStatus: function(task, progress, status) {
        var progstr = Math.round(progress) + "%";
        task.find(".progress").css("width", progstr).attr("title", progstr);
        if (status) {
            task.find(".progressbar").attr("class", "progressbar " + status.toLowerCase());
        } else if (progress > 99.5) {
            task.find(".progressbar").attr("class", "progressbar success");
        } else {
            task.find(".progressbar").attr("class", "progressbar started");
        }       
    },


    // set a waiting spinner when doing something
    setWaiting: function(waiting) {        
        if (waiting) {
            this._batchdiv.addClass("waiting");
        } else {
            this._batchdiv.removeClass("waiting");
        }
    },


    setTaskWaiting: function(task, waiting) {
        task.find(".progressbar_container").toggleClass("waiting", waiting);        
    },
    

    refreshUnlessPolling: function() {
        if (this.isComplete()) {
            this.manualRefresh();
        }
    },

               
    // check whether all tasks are complete
    isComplete: function() {
        return this._batchdata.extras.is_complete;
    },


    // Scrolling-related functions
    //
    toggleScrollBar: function(show) {
        if (show) {
            $(".tl_scrollcontainer").show(100);
            $(".task_list").css("margin-right", "15px");
        } else {
            $(".tl_scrollcontainer").hide(100);
            $(".task_list").css("margin-right", "0px");
        }
    },


    setScrollHandleHeight: function() {
        // work out how big the scroll handle should be
        var taskcount = this._batchdata.extras.task_count;
        var percheight = this._maxtasks / taskcount;
        
        // hide the scrollbar if necessary
        this.toggleScrollBar(taskcount > this._maxtasks);
        
        var pixheight = Math.max(30, $("#scrollbar").height() * percheight);
        $("#scrollhandle").animate({height: pixheight}, 100);
    },


    scrollDown: function(event) {
        this._taskoffset = Math.min(
            this._batchdata.extras.task_count - this._maxtasks, 
            this._taskoffset + 1);
        this.refreshUnlessPolling();
        this.setScrollHandlePosition();        
    },


    scrollUp: function(event) {
        this._taskoffset = Math.max(0, this._taskoffset - 1);
        this.refreshUnlessPolling();
        this.setScrollHandlePosition();        
    },


    setScrollHandlePosition: function() {
        var bar = $("#scrollbar");
        var handle = $("#scrollhandle");
        var offset = Math.floor(handle.height() / 2);
        var start = bar.position().top + offset;
        var end = bar.position().top + bar.height() - offset;
        var range = end - start + 1;

        // shortcuts for top and bottom of range 
        if (this._taskoffset == 0) {
            handle.css("top", "0px");
        } else if (this._taskoffset + this._maxtasks == this._batchdata.extras.task_count) {
            handle.css("top", ( bar.height() - handle.height() ) + "px");
        } else {
            var maxoffset = this._batchdata.extras.task_count - this._maxtasks;
            var current = (this._taskoffset / maxoffset) * range;
            handle.css("top", current + "px");
        }
    },


    onScroll: function(event, ui) {
        // work out where we are in the div
        var bar = $("#scrollbar");
        var handle = $("#scrollhandle");
        var offset = Math.floor(handle.height() / 2);
        var start = bar.position().top + offset;
        var current = handle.position().top + offset - start;
        var end = bar.position().top + bar.height() - offset;
        var range = end - start + 1;
        var percent =  (current / range) * 100;

        var maxoffset = this._batchdata.extras.task_count - this._maxtasks;
        this._taskoffset = Math.round(maxoffset * (current / range));
        // clamp it's range
        this._taskoffset = Math.min(maxoffset, this._taskoffset);
        this._taskoffset = Math.max(0, this._taskoffset);
        this._scrollwin.text("Task " + (this._taskoffset + 1)); 
    },

    onScrollStart: function(event, ui) {
        $("body").append(this._scrollwin);
        this._scrollwin
            .show()
            .css("top", this._tasklist.position().top + 20)
            .css("left", this._tasklist.position().left + 20);

    },

    onScrollStop: function(event, ui) {
        this._scrollwin.remove();
        this.refreshUnlessPolling();
    },


    getBatchClass: function(task_type) {
        return task_type.substr(0, 
                task_type.search(/\./));
    },
               


    _createBatchHeaderUi: function() {
        var self = this;
        var batch = $("<div></div>")
            .addClass("batch");
        var controls = $("<div></div>")
            .addClass("batch_controls");
        batch.append(controls);
        controls.append(
            $("<div></div>")
                .addClass("batch_header")
                .append($("<div></div>")
                    .addClass("batch_name")
                )
                .append($("<a></a>")
                    .attr("href", "#")
                    .text("View Transcripts")
                    .addClass("transcript_link")
                    .attr("title", "View Transcript")
                )
        );
        this._addProgressBar(controls);
        controls.append(
            $("<span></span>")
                .addClass("page_info"));
        $.each(this._batch_buttons, function(i, button) {
            self._button_template.clone()
                .attr("title", button.title)
                .addClass(button.classes)
                .appendTo(controls);
        });
        controls.append(this._statusfilter.ui());
        this._batchdiv.append(batch);
    },


    _createTaskListUi: function() {
        var self = this;
        var tlcontainer = $("<div></div>")
            .addClass("tl_container");
        var tlscrollcontainer = $("<div></div>")
            .addClass("tl_scrollcontainer");
        var scrollup = $("<div></div>")
            .addClass("tl_scrollup")
            .attr("id", "scrollup");
        var scrollbar = $("<div></div>")
            .addClass("tl_scrollbar")
            .attr("id", "scrollbar");
        var scrolldown = $("<div></div>")
            .addClass("tl_scrolldown")
            .attr("id", "scrolldown");
        var scrollhandle = $("<div></div>")
            .addClass("tl_scrollhandle")
            .attr("id", "scrollhandle")
            .draggable({
                containment: "parent",
                axis: "y",
                start: function(e) { self.onScrollStart(e); },
                drag:  function(e) { self.onScroll(e); },
                stop:  function(e) { self.onScrollStop(e); },
            });
        tlscrollcontainer
            .append(scrollup)
            .append(scrollbar.append(scrollhandle))
            .append(scrolldown)
            .appendTo(tlcontainer);

        tlcontainer.append(this._tasklist);

        var task = $("<div></div>")
            .addClass("batch_task")
            .hide();
        task.append(
            $("<span></span>")
                .addClass("page_name"));
        this._addProgressBar(task);

        $.each(this._task_buttons, function(i, button) {
            self._button_template.clone()
                .attr("title", button.title)
                .addClass(button.classes)
                .appendTo(task);
        });

        task.append(
            $("<span></span>")
                .addClass("page_info"));
        for (var i = 0; i < this._maxtasks; i++) {
            this._tasklist.append(task.clone());
        }

        tlcontainer.mousewheel(function(event, delta) {
            if (self._maxtasks < self._batchdata.extras.task_count)
                return;
            if (delta > 0)
                self.scrollUp(event);
            else if (delta < 0)
                self.scrollDown(event);
        });

        this._batchdiv.append(tlcontainer);        
    },


    _addProgressBar: function(task) {
        var holder = $("<div></div>")
            .addClass("progressbar_container");
        var progressbar = $("<span></span>")
            .addClass("progressbar");
        var progress = $("<span></span>")
            .addClass("progress");
        task.append(holder.append(progressbar.append(progress)));
    },


});




