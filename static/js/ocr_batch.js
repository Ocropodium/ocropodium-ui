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

function OcrBatch(insertinto_id, batchdata) {
    // extract the batchname from the job name, delimited by "::"
    var m_batchname = batchdata.fields.name;
    var m_resultsurl = "/batch/results/" + batchdata.pk;
    var self = this;

    // create container structure
    var container = $("<div></div>")
        .addClass("ocr_page_container")
        .addClass("widget");  
    var phead = $("<div></div>")
        .addClass("ocr_page_head")
        .addClass("widget_header")
        .attr("id", "ocr_page_head")
        .text(m_batchname);
    var pdiv = $("<div></div>")
        .addClass("ocr_page")
        .addClass("waiting")
        .attr("id", "ocr_page")
        .data("batchname", m_batchname);

    // setup header buttons
    var layout = $("<a></a>").attr("href", "#")
        .addClass("view_link")
        .text("View Layout");
    var viewlink = $("<a></a>")
        .attr("target", "_blank")
        .addClass("result_link")
        .text("View Layout")
        .click(function(event) {
            if ($(this).text() == "View Layout") {
                self.positionByBounds();
                $(this).text("View Paragraphs");
            } else {
                self.insertBreaks();
                $(this).text("View Layout");
            } 
        })
        .appendTo(phead);
    var textlink = viewlink.clone()
        .attr("href", m_resultsurl + "?format=text")
        .text("Text")
        .appendTo(phead);
    var jsonlink = viewlink.clone()
        .attr("href", m_resultsurl + "?format=json")
        .text("Json")
        .appendTo(phead);
    // add the containter to the
    container.append(phead).append(pdiv).appendTo("#" + insertinto_id);

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



    // show an error
    var setError = function(error, traceback) {
        pdiv.removeClass("waiting")
            .addClass("error")
            .html("<h4>Error: " + error + "</h4>");
        
        if (traceback) {
            pdiv.append(
                $("<div></div>").addClass("traceback")
                    .append("<pre>" + traceback + "</pre>")                                
            );
        }                
    }

    var setBatchResults = function() {
        var batch = pdiv.find("#batch" + batchdata.pk);
        if (batch.length == 0) {
            batch = $("<div></div>")
                .addClass("batch_task")
                .attr("id", "batch" + batchdata.pk)
            batch.append(
                $("<span></span>")
                    .addClass("page_name")
                    .text(batchdata.fields.name));
            var progressbar = $("<span></span>")
                .addClass("progress_outer");
            var progress = $("<span></span>")
                .addClass("progress");
            batch.append(progressbar.append(progress));
            batch.append(
                $("<span></span>")
                    .addClass("page_info"));
            batch.append(
                $("<a></a>")
                    .attr("href", "#")
                    .addClass("retry_batch")
                    .data("pk", batchdata.pk)
                    .text("Retry"));
            pdiv.append(batch);
        }
        batch.find(".progress")
            .css("width", batchdata.extras.estimate_progress + "%");
        var complete = batchdata.extras.estimate_progress > 99;
        batch.find(".progress").toggleClass("progress_done", complete);
        batch.find(".progress_outer").toggleClass("progress_outer_done", complete);                
        
        return batch;
    }


    // add results to the page.
    var updateResults = function() {
        pdiv.removeClass("waiting");
        //var percentdone = (results.completed_count / results.count) * 100;
        //pdiv.text(results.count + " images (" + Math.round(percentdone) + "%)");
        var batch = setBatchResults();
        var tasklist = pdiv.find("#batch" + batchdata.pk + "_tasks");
        if (tasklist.length == 0) {
            tasklist = $("<div></div>")
                .attr("id", "batch" + batchdata.pk + "_tasks")
                .addClass("task_list");
            tasklist.insertAfter(batch);
        }

        $.each(batchdata.fields.tasks, function(i, taskdata) {
            var task = tasklist.find("#task" + taskdata.pk);
            if (task.length == 0) {
                task = $("<div></div>")
                    .addClass("batch_task")
                    .attr("id", "task" + taskdata.pk)
                task.append(
                    $("<span></span>")
                        .addClass("page_name")
                        .text(taskdata.fields.page_name));
                var progressbar = $("<span></span>")
                    .addClass("progress_outer");
                var progress = $("<span></span>")
                    .addClass("progress");
                task.append(progressbar.append(progress));
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
            }
            task.find(".progress")
                .css("width", taskdata.fields.progress + "%");
            if (taskdata.fields.status == "DONE") {
                task.find(".progress").toggleClass("progress_done", true);
                task.find(".progress_outer").toggleClass("progress_outer_done", true);                
            } else if (taskdata.fields.status == "ERROR") {
                task.find(".progress")
                    .toggleClass("progress_error", true)
                    .css("width", "100%");
                task.find(".progress_outer")
                    .toggleClass("progress_outer_done", true);
            }


            if (taskdata.fields.lines != null) {
                task.find(".page_info").text("Lines: " + taskdata.fields.lines);
            }
        });
    }


    // check whether all tasks are complete
    this.isComplete = function() {
        var done = 0;
        $.each(batchdata.fields.tasks, function(i, t) {
            if (t.fields.status.match(/DONE|ERROR/)) {
                done++;
            }
        });        
        return done == batchdata.fields.tasks.length;
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
            batchdata = data[0];
            updateResults();
            return self.isComplete(); 
        }
        return true;
    }

    // set a waiting spinner when doing something
    this.setWaiting = function(waiting) {
        if (waiting) {
            pdiv.addClass("waiting");
        } else {
            pdiv.removeClass("waiting");
        }
    }

    
    // check the server for complete results...
    var pollForResults = function(polltime) {
        $.ajax({
            url: m_resultsurl,
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
