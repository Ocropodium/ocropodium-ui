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
    var batchname = batchdata.fields.name;
    var resultsurl = "/batch/results/" + batchdata.pk;
    var boxpattern = new RegExp(/(\d+) (\d+) (\d+) (\d+)/);
    var self = this;

    // create container structure
    var container = $("<div></div>")
        .addClass("ocr_page_container")
        .addClass("widget");  
    var phead = $("<div></div>")
        .addClass("ocr_page_head")
        .addClass("widget_header")
        .attr("id", "ocr_page_head")
        .text(batchname);
    var pdiv = $("<div></div>")
        .addClass("ocr_page")
        .addClass("waiting")
        .attr("id", "ocr_page")
        .data("batchname", batchname);

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
        .attr("href", resultsurl + "?format=text")
        .text("Text")
        .appendTo(phead);
    var jsonlink = viewlink.clone()
        .attr("href", resultsurl + "?format=json")
        .text("Json")
        .appendTo(phead);
    // add the containter to the 
    container.append(phead).append(pdiv).appendTo("#" + insertinto_id); 


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

    // add results to the page.
    var setResults = function(results) {
        pdiv.removeClass("waiting");
        //var percentdone = (results.completed_count / results.count) * 100;
        //pdiv.text(results.count + " images (" + Math.round(percentdone) + "%)");
        
        $.each(results, function(i, taskdata) {
            var task = pdiv.find("#task" + taskdata.pk);
            if (task.length == 0) {
                task = $("<div></div>")
                    .addClass("batch_task")
                    .attr("id", "task" + taskdata.pk)
                    .text(taskdata.fields.page_name);
                var progressbar = $("<span></span>")
                    .addClass("progress_outer");
                var progress = $("<span></span>")
                    .addClass("progress");
                task.append(progressbar.append(progress));
                pdiv.append(task);
            }
            task.find(".progress")
                .css("width", taskdata.fields.progress + "%");
            if (taskdata.fields.status == "DONE") {
                task.find(".progress").addClass("progress_done");
                task.find(".progress_outer").addClass("progress_outer_done");                
            }
        });
    }



    // handle the results of each poll
    var processData = function(data) {
        var done = 0;
        $.each(data, function(i, t) {
            if (t.fields.status.match(/DONE|ERROR/)) {
                done++;
            }
        });        

        if (data.error) {
            setError(data.error, data.trace);
        } else {
            setResults(data);
            return done == data.length; 
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
            url: resultsurl,
            type: "POST",
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
