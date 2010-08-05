// Object to represent and display a page of OCR data that's being 
// processed by the server.  The server passes back a list of 'page
// jobs' from which can be derived the page and job names.  
//
//  {
//      job_name: "simple.png::2f80247a-85b4-11df-8309-002564d1c84c",
//      status:   "PENDING",
//      results:  null,
//  }
//
//
// This object then creates an HTML container for the data and 
// repeatedly polls /batch/results/<batch-pk> until to status
// changes (to SUCCESS or ERROR) at which point to displays
// whatever is in 'results'.

function OcrBatch(insertinto_id, batch_id) {
    // extract the batchname from the job name, delimited by "::"
    var m_resultsurl = "/batch/results/" + batch_id;

    // time to recheck running tasks
    var m_polltime = 300; 

    // max number of tasks to load
    var m_maxtasks = 15;

    // start of first loaded task
    var m_taskoffset = 0;

    // cache of data, initially empty
    var m_batchdata = null;

    // alias 'this' for use from within callbacks
    var self = this;

    // UI bits it's useful to keep a reference to:
    var m_container = $("<div></div>")
        .addClass("ocr_page_container")
        .addClass("widget");  
    var m_header = $("<div></div>")
        .addClass("ocr_page_head")
        .addClass("widget_header")
        .attr("id", "ocr_page_head");
    var m_batchdiv = $("<div></div>")
        .addClass("ocr_page")
        .addClass("waiting")
        .attr("id", "ocr_page");

    var m_scrollwin = $("<span></span>")
        .addClass("scroll_viewer")
        .attr("id", "scroll_viewer");

    this.buildUi = function() {
        // create container structure

        // add the containter to the
        m_container.append(m_header).append(m_batchdiv).appendTo("#" + insertinto_id);
    }



    this.init = function() {
        self.buildUi();
        self.pollForResults(m_polltime);

    }


    /*
     *  Events
     */

    $(".retry_task").live("click", function(event) {
        var pk = $(this).data("pk");
        $.ajax({
            url: "/batch/retry_task/" + pk + "/",
            type: "POST",
            dataType: "json",
            success: function(data) {
                if (data.ok) {
                    $("#task" + pk).find(".progress_outer")
                        .removeClass("progress_outer_done");
                    $("#task" + pk).find(".progress")
                        .removeClass("progress_done").css("width", "0%");

                }
                self.pollForResults(300);                
            },
        });
        event.preventDefault();    
    });


    $("#scrolldown").live("click", function(event) {
        m_taskoffset = Math.min(
            m_batchdata.extras.task_count - m_maxtasks, 
            m_taskoffset + 1);
        if (self.isComplete()) {
            pollForResults(m_polltime);
        }
        setScrollHandlePosition();        
    });

    $("#scrollup").live("click", function(event) {
        m_taskoffset = Math.max(0, m_taskoffset - 1);
        if (self.isComplete()) {
            pollForResults(m_polltime);
        }        
        setScrollHandlePosition();        
    });


    $(".retry_batch").live("click", function(event) {
        var pk = $(this).data("pk");
        $.ajax({
            url: "/batch/retry_batch/" + pk + "/",
            type: "POST",
            dataType: "json",
            success: function(data) {
                if (data.ok) {
                    $("#batch" + pk + ", #batch" + pk + "_list")
                        .find(".progress_outer")
                        .removeClass("progress_outer_done");
                    $("#batch" + pk + ", #batch" + pk + "_list")
                        .find(".progress")
                        .removeClass("progress_done").css("width", "0%");

                }
                self.pollForResults(300);                
            },
        });
        event.preventDefault();    
    });

    var setScrollHandlePosition = function() {
        var bar = $("#scrollbar");
        var handle = $("#scrollhandle");
        var offset = Math.floor(handle.height() / 2);
        var start = bar.position().top + offset;
        var end = bar.position().top + bar.height() - offset;
        var range = end - start + 1;

        // shortcuts for top and bottom of range 
        if (m_taskoffset == 0) {
            handle.css("top", "0px");
        } else if (m_taskoffset + m_maxtasks == m_batchdata.extras.task_count) {
            handle.css("top", ( bar.height() - handle.height() ) + "px");
        } else {
            var maxoffset = m_batchdata.extras.task_count - m_maxtasks;
            var current = (m_taskoffset / maxoffset) * range;
            handle.css("top", current + "px");
        }
    }


    var onScroll = function(event, ui) {
        // work out where we are in the div
        var bar = $("#scrollbar");
        var handle = $("#scrollhandle");
        var offset = Math.floor(handle.height() / 2);
        var start = bar.position().top + offset;
        var current = handle.position().top + offset - start;
        var end = bar.position().top + bar.height() - offset;
        var range = end - start + 1;
        var percent =  (current / range) * 100;

        var maxoffset = m_batchdata.extras.task_count - m_maxtasks;
        m_taskoffset = Math.round(maxoffset * (current / range));
        // clamp it's range
        m_taskoffset = Math.min(maxoffset, m_taskoffset);
        m_taskoffset = Math.max(0, m_taskoffset);
        m_scrollwin.text("Task " + (m_taskoffset + 1)); // + "  " + Math.round(percent) + "% ");
    }

    var onScrollStart = function(event, ui) {
        $("body").append(m_scrollwin);
        var tasklist = $(".task_list");
        m_scrollwin
            .show()
            .css("top", tasklist.position().top + 20)
            .css("left", tasklist.position().left + 20);

    }

    var onScrollStop = function(event, ui) {
        m_scrollwin.remove();
        if (self.isComplete()) {
            pollForResults(m_polltime);
        }
    }

    var updateScrollButtons = function(event) {
    }


    // show an error
    var setError = function(error, traceback) {
        m_batchdiv.removeClass("waiting")
            .addClass("error")
            .html("<h4>Error: " + error + "</h4>");
        
        if (traceback) {
            m_batchdiv.append(
                $("<div></div>").addClass("traceback")
                    .append("<pre>" + traceback + "</pre>")                                
            );
        }                
    }

    var setBatchResults = function() {
        var batch = m_batchdiv.find("#batch" + m_batchdata.pk);
        if (batch.length == 0) {
            batch = $("<div></div>")
                .addClass("batch")
                .attr("id", "batch" + m_batchdata.pk)
            batch.append(
                $("<span></span>")
                    .addClass("page_name")
                    .text(m_batchdata.fields.name));
            addProgressBar(batch);
            batch.append(
                $("<span></span>")
                    .addClass("page_info"));
            batch.append(
                $("<a></a>")
                    .attr("href", "#")
                    .addClass("retry_batch")
                    .data("pk", m_batchdata.pk)
                    .text("Retry All"));
            m_batchdiv.append(batch);
        }
        setProgressStatus(batch, m_batchdata.extras.estimate_progress);

        return batch;
    }


    var setProgressStatus = function(task, progress, status) {
        task.find(".progress").css("width", progress + "%");
        if (status) {
            task.find(".progressbar").attr("class", "progressbar " + status.toLowerCase());
        } else if (progress > 99.5) {
            task.find(".progressbar").attr("class", "progressbar done");
        } else {
            task.find(".progressbar").attr("class", "progressbar running");
        }       
    }


    var addProgressBar = function(task) {
        var progressbar = $("<span></span>")
            .addClass("progressbar");
        var progress = $("<span></span>")
            .addClass("progress");
        task.append(progressbar.append(progress));
    }

    var setScrollHandleHeight = function() {
        // work out how big the scroll handle should be
        var taskcount = m_batchdata.extras.task_count;
        if (taskcount < m_maxtasks) {
            $(".tl_scrollcontainer").hide();
            $(".task_list").css("margin-right", "0px");
        } else {
            var percheight = m_maxtasks / taskcount;
            var pixheight = Math.max(30, $("#scrollbar").height() * percheight);
            $("#scrollhandle").height(pixheight);
        }
    }

    // add results to the page.
    var updateResults = function() {

        // set titles
        $("#ocr_page_head").text(m_batchdata.fields.name);

        m_batchdiv.removeClass("waiting");
        //var percentdone = (results.completed_count / results.count) * 100;
        //m_batchdiv.text(results.count + " images (" + Math.round(percentdone) + "%)");
        var batch = setBatchResults();
        var tasklist = m_batchdiv.find("#batch" + m_batchdata.pk + "_tasks");
        if (tasklist.length == 0) {
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
                    start: onScrollStart,
                    drag: onScroll,
                    stop: onScrollStop,
                });
            tlscrollcontainer
                .append(scrollup)
                .append(scrollbar.append(scrollhandle))
                .append(scrolldown)
                .appendTo(tlcontainer);

            tasklist = $("<div></div>")
                .attr("id", "batch" + m_batchdata.pk + "_tasks")
                .addClass("task_list");
            tlcontainer.append(tasklist).insertAfter(batch);
        }
        setScrollHandleHeight();


        $(".batch_task").remove();

        for (var i in m_batchdata.fields.tasks) {
            var taskdata = m_batchdata.fields.tasks[i];
            var task = tasklist.find("#task" + taskdata.pk);
            task = $("<div></div>")
                .addClass("batch_task")
                .attr("id", "task" + taskdata.pk)
            task.append(
                $("<span></span>")
                    .addClass("page_name")
                    .text(taskdata.fields.page_name));
            addProgressBar(task);
            task.append(
                $("<a></a>")
                    .attr("href", "#")
                    .addClass("retry_task")
                    .data("pk", taskdata.pk)
                    .text("Retry"));
            task.append(
                $("<span></span>")
                    .addClass("page_info"));
            tasklist.append(task);
            
            setProgressStatus(task, taskdata.fields.progress, taskdata.fields.status);
            if (taskdata.fields.lines != null) {
                task.find(".page_info").text("Lines: " + taskdata.fields.lines);
            }
        }
    }


    // check whether all tasks are complete
    this.isComplete = function() {
        var done = 0;
        $.each(m_batchdata.fields.tasks, function(i, t) {
            if (t.fields.status.match(/DONE|ERROR/)) {
                done++;
            }
        });        
        return done == m_batchdata.fields.tasks.length;
    }

    this.updateResults = function() {
        updateResults();
    }

    // handle the results of each poll - we should
    // get back an array containing only one element
    // (due to the way django serializes our query
    var processData = function(data) {
        if (data.error) {
            setError(data.error, data.trace);
        } else {
            m_batchdata = data[0];
            updateResults();
            return self.isComplete(); 
        }
        return true;
    }

    // set a waiting spinner when doing something
    this.setWaiting = function(waiting) {
        if (waiting) {
            m_batchdiv.addClass("waiting");
        } else {
            m_batchdiv.removeClass("waiting");
        }
    }

    
    // check the server for complete results...
    var pollForResults = function(polltime) {
        $.ajax({
            url: m_resultsurl,
            data: {start: m_taskoffset, limit: m_maxtasks},
            type: "GET",
            dataType: "json",
            success: function(data) {
                if (!processData(data)) {
                    setTimeout(function() {
                        pollForResults(polltime);
                    }, polltime);
                }                
            },
            error: function(xhr, statusText, errorThrown) {
                setError("Http Error " + statusText, errorThrown);
            }
        }); 
    }


    // wrapper for external access.  I don't really know why, but
    // if the Async function is called directly from this function
    // rather than the closure, async calls from multiple separate
    // objects seem to get jumbled up.
    this.pollForResults = function(polltime) {
        pollForResults(polltime);
    }
}
