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
// repeatedly polls /ocr/results/<JOBNAME> until to status
// changes (to SUCCESS or ERROR) at which point to displays
// whatever is in 'results'.

function OcrPage(insertinto_id, page_id, jobname) {
    // extract the pagename from the job name, delimited by "::"
    var pagename = jobname.split("::")[0].replace(/\.[^\.]+$/, "");
    var resultsurl = "/ocr/results/" + jobname;
    var boxpattern = new RegExp(/(\d+) (\d+) (\d+) (\d+)/);
    var me = this;

    // create container structure
    var container = $("<div></div>")
        .addClass("ocr_page_container")
        .addClass("widget");  
    var phead = $("<div></div>")
        .addClass("widget_header")
        .addClass("ocr_page_head")
        .attr("id", "ocr_page_" + page_id + "_head")
        .text(pagename);
    var pdiv = $("<div></div>")
        .addClass("ocr_page")        
        .addClass("waiting")
        .attr("id", "ocr_page_" + page_id)
        .data("jobname", jobname);

    // setup header buttons
    var rlink = $("<a></a>")
        .attr("target", "_blank")
        .addClass("result_link")
        .addClass("button");
    var textlink = rlink.clone()
        .attr("href", resultsurl + "?format=text")
        .text("Text")
        .appendTo(phead);
    var jsonlink = rlink.clone()
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
        pdiv.data("bbox", results.box);
        $.each(results.lines, function(linenum, line) {
            lspan = $("<span></span>")
                .text(line.text)
                .addClass("ocr_line")
                .data("bbox", line.box)
                .data("num", line.line);
            pdiv.append(lspan);                        
        });
        me.onLinesReady();
    }



    // handle the results of each poll
    var processData = function(data) {
        if (data.error) {
            setError(data.error, data.trace);
        } else if (data.status == "SUCCESS") {
            setResults(data.results);
        } else if (data.status == "PENDING") {
            return false;
        } else {
            pdiv.html("<p>Oops, task finished with status: " + data.status + "</p>");
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


OcrPage.prototype.onLinesReady = function() {

}
