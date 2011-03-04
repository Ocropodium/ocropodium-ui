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
        this._maxitems = 15;

        // start of first loaded task
        this._itemoffset = 0;

        // cache of data, initially empty
        this._batchdata = null;

        // store the id for the next timeout
        this._polltimeout = -1;

       // time stationary off the scroll drag  
       this._scrolltimeout = -1;

       // difference between scroll and loaded data
       this._dataoffset = 0;

        // status filter widget
        this._statusfilter = new MultiFilterList(
            "status",
            ["INIT", "PENDING", "RETRY", "STARTED", "SUCCESS", "ERROR", "ABORTED"],
            true
        );

        this._listeners = {
            onTaskSelected: [],
            onTaskDeselected: [],
            onUpdate: [],
        };

        // class of this batch.  Subclasses should override
        // this to change, e.g the icon appearance
        this._batchclass = "convert";

        // url at which to view batch results.  Again, subclasses
        // can override this
        this._viewurl = "/batch/transcript/" + this._batch_id;

        // text for the view link
        this._viewtext = "View Transcripts";

        // url for exporting batch results... might not be relevant
        // subclasses should set to null
        this._exporturl = "/batch/export_options/" + this._batch_id;

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

        this._task_buttons = [{
                title: "Retry Task",
                classes: "ui-icon-refresh retry_task",
                baseurl: "/ocrtasks/retry/",
            }, {
                title: "Abort Task",
                classes: "ui-icon-circle-close abort_task",
                baseurl: "/ocrtasks/abort/",
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

        $(".batch_task").bind("click", function(event) {
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

        $(".export_link").click(function(event) {
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

        //$(".batch_task").bind("click", function(event) {
        //    console.log("clicked");
        //    return false;
        //});

        $(".ui-icon", this._batchdiv).bind("mouseover mouseout", function(event) {
            if (event.type == "mouseover") {
                $(this).addClass("ui-state-hover");
            } else {
                $(this).removeClass("ui-state-hover");
            }
        });


        $(".retry_task").bind("click", function(event) {
            var pk = $(this).data("pk");
            $.ajax({
                url: "/ocrtasks/retry/" + pk + "/",
                type: "POST",
                dataType: "json",
                beforeSend: function(e) { 
                    self.setTaskWaiting($("#task" + pk), true);
                },
                error: OCRJS.ajaxErrorHandler,
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
            event.stopPropagation();    
        });


        $(".abort_task").bind("click", function(event) {
            var pk = $(this).data("pk");
            $.ajax({
                url: "/ocrtasks/abort/" + pk + "/",
                type: "POST",
                dataType: "json",
                beforeSend: function(e) {                
                    self.setTaskWaiting($("#task" + pk), true);
                },
                error: OCRJS.ajaxErrorHandler,
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
            event.stopPropagation();    
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
                error: OCRJS.ajaxErrorHandler,
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
        this._itemoffset = 0;
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
            this._dataoffset = 0;
            this.updateResults(this._batchdata);
            return this.isComplete(); 
        }
        return true;
    },


    // check the server for complete results...
    pollForResults: function(polltime) {
        var self = this;                        
        params = "start=" + this._itemoffset + "&limit=" + this._maxitems;
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
            error: OCRJS.ajaxErrorHandler,
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
        this.setBatchType(batchdata);                                 
        var batch = this._batchdiv.find(".batch");
        batch.attr("id", "batch" + batchdata.pk)
        batch.find(".batch_header").attr("class", "batch_header " + this._batchclass);

        // set titles
        batch
            .find(".batch_name")
            .text(batchdata.fields.name)
        var link = batch
            .find(".transcript_link");
        var export = batch
            .find(".export_link");
        link
            .attr("href", this._viewurl)
            .text(this._viewtext);
        if (this._exporturl) {
            export
                .attr("href", this._exporturl + batchdata.pk + "/")
                .text("Export").show();
        } else {
            export.hide();
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

        var i = -this._dataoffset;
        for (var count = 0; count < this._maxitems; count++) {
            var taskdata = batchdata.fields.tasks[i];
            var task = this._tasklist.find(".batch_task").slice(count);
            // hide the task if we've run out of data - this happens
            // if there are less than m_maxitems tasks in the set.
            if (i < 0 || i > batchdata.fields.tasks.length - 1) {
                task //.hide()
                    .attr("id", null)
                    .find(".page_name, .page_info")
                    .text("-")
                    .end()
                    .find("a")
                    .data("pk", null)
                    .attr("href", "#")
                    .end();
                if (i > batchdata.fields.tasks.length - 1)
                    task.hide();
                i++;
                continue;                
            }

            task
                .attr("id", "task" + taskdata.pk)
                .attr("href", "#task" + taskdata.pk)
                .data("pk", taskdata.pk)
                .data("index", i)
                .find(".page_name")
                .text(taskdata.fields.page_name)
                .end()
                .find("a").data("pk", taskdata.pk)
                .end()
                .find(".retry_task")
                .attr("href", "/ocrtasks/retry/" + taskdata.pk + "/")
                .end()
                .find(".abort_task")
                .attr("href", "/ocrtasks/abort/" + taskdata.pk + "/");
            this.setProgressStatus(task, taskdata.fields.progress, taskdata.fields.status);
            if (taskdata.fields.lines) {
                task.find(".page_info").text("Lines: " + taskdata.fields.lines);
            }
            task.show();
            i++;
        }

        this.setScrollHandleHeight();
        this.callListeners("onUpdate");
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


    //
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
        var percheight = this._maxitems / taskcount;
        
        // hide the scrollbar if necessary
        this.toggleScrollBar(taskcount > this._maxitems);
        
        var pixheight = Math.max(30, $("#scrollbar").height() * percheight);
        $("#scrollhandle").animate({height: pixheight}, 100);
    },


    scrollDown: function(event) {
        this._itemoffset = Math.min(
            this._batchdata.extras.task_count - this._maxitems, 
            this._itemoffset + 1);
        this.refreshUnlessPolling();
        this.setScrollHandlePosition();        
    },


    scrollUp: function(event) {
        this._itemoffset = Math.max(0, this._itemoffset - 1);
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
        if (this._itemoffset == 0) {
            handle.css("top", "0px");
        } else if (this._itemoffset + this._maxitems == this._batchdata.extras.task_count) {
            handle.css("top", ( bar.height() - handle.height() ) + "px");
        } else {
            var maxoffset = this._batchdata.extras.task_count - this._maxitems;
            var current = (this._itemoffset / maxoffset) * range;
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

        var maxoffset = this._batchdata.extras.task_count - this._maxitems;
        var newoffset = Math.round(maxoffset * (current / range)); 
        var diff = this._itemoffset - newoffset;
        if (diff != 0) {
            this._dataoffset += diff;
            this.updateResults(this._batchdata); 
        }
        this._itemoffset = newoffset;
        // clamp it's range
        this._itemoffset = Math.min(maxoffset, this._itemoffset);
        this._itemoffset = Math.max(0, this._itemoffset);
        this._scrollwin.text("Task " + (this._itemoffset + 1));
        
        if (this._scrolltimeout != -1) {            
            clearTimeout(this._scrolltimeout);
        }
        var self = this;
        this._scrolltimeout = setTimeout(function() {
            self.refreshUnlessPolling();
        }, 100);
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
        //this.refreshUnlessPolling();
    },


    getBatchClass: function(task_type) {
        return task_type.substr(0, 
                task_type.search(/\./));
    },
               
    setBatchType: function(batchdata) {                      
        this._batchclass = this.getBatchClass(batchdata.fields.task_type);
        switch (this._batchclass) {
            case "convert":
                this._viewurl = "/batch/transcript/" + this._batch_id;
                this._viewtext = "View Transcripts";
                this._exporturl = "/batch/export_options/" + this._batch_id;
                break;
            case "fedora":
                this._viewurl = "/batch/transcript/" + this._batch_id;
                this._viewtext = "View Transcripts";
                this._exporturl = null;
                break;
            case "compare":
                this._viewurl = "/training/comparison/?batch=" + this._batch_id;
                this._viewtext = "View Comparison";
                this._exporturl = null;
                break;
            default:
                break;
        }
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
                .append($("<a></a>")
                    .attr("href", "#")
                    .text("Export")
                    .addClass("export_link")
                    .attr("title", "Export Batch Transcripts")
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

        var task = $("<a></a>")
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
                .appendTo(task)
                .data("baseurl", button.baseurl);
        });

        task.append(
            $("<span></span>")
                .addClass("page_info"));

        for (var i = 0; i < this._maxitems; i++) {
            this._tasklist.append(task.clone());
        }

        tlcontainer.mousewheel(function(event, delta) {
            if (self._maxitems < self._batchdata.extras.task_count)
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




