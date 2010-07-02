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

function OcrPage(insertinto_id, page_id, data) {
    // extract the pagename from the job name, delimited by "::"
    var pagename = data.job_name.split("::")[0].replace(/\.[^\.]+$/, "");
    var resultsurl = "/ocr/results/" + data.job_name;
    var boxpattern = new RegExp(/(\d+) (\d+) (\d+) (\d+)/);
    var me = this;

    // create container structure
    var container = $("<div></div>")
        .addClass("ocr_page_container");  
    var phead = $("<div></div>")
        .addClass("ocr_page_head")
        .attr("id", "ocr_page_" + page_id + "_head")
        .text(pagename);
    var pdiv = $("<div></div>")
        .addClass("ocr_page")
        .addClass("waiting")
        .attr("id", "ocr_page_" + page_id)
        .data("jobname", data.job_name);

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
                me.positionByBounds();
                $(this).text("View Paragraphs");
            } else {
                me.insertBreaks();
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
        pdiv.attr("bbox", results.box[0] + " " + results.box[1]
                + " " + results.box[2] + " " + results.box[3]);
        $.each(results.lines, function(linenum, line) {
            lspan = $("<span></span>")
                .text(line.text)
                .addClass("ocr_line")
                .attr("bbox", line.box[0] + " " + line.box[1] 
                    + " " + line.box[2] + " " + line.box[3]);
            pdiv.append(lspan);                        
        });
        me.insertBreaks(pdiv);
    }



    // handle the results of each poll
    var processData = function(newdata) {
        if (newdata.error) {
            setError(newdata.error, newdata.trace);
        } else if (newdata.status == "SUCCESS") {
            setResults(newdata.results);
        } else if (newdata.status == "PENDING") {
            return false;
        } else {
            pdiv.html("<p>Oops, task finished with status: " + newdata.status + "</p>");
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


    // copy scope for making recursive poll call
    var pollForResults = function(polltime) {
        $.ajax({
            url: resultsurl,
            dataType: "json",
            success: function(newdata) {
                if (!processData(newdata)) {
                    setTimeout(function() {
                        pollForResults();
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




    //
    // Layout: Functions for arranging the lines in certain ways
    //

    // parse bbox="0 20 500 300" into [0, 20, 500, 300]
    var parseBoundingBoxAttr = function(bbox) {
        var dims = [-1, -1, -1, -1];
        if (bbox.match(boxpattern)) {
            dims[0] = parseInt(RegExp.$1);
            dims[1] = parseInt(RegExp.$2); 
            dims[2] = parseInt(RegExp.$3);
            dims[3] = parseInt(RegExp.$4);            
        }
        return dims;
    }

    // Fudgy function to insert line breaks (<br />) in places
    // where there are large gaps between lines.  Significantly
    // improves the look of a block of OCR'd text.
    this.insertBreaks = function() {
        var lastyh = -1;
        var lasth = -1;
        var lastitem;
        pdiv.children(".ocr_line").each(function(lnum, item) {
            var dims = parseBoundingBoxAttr($(item).attr("bbox"));
            var y = dims[1];  // bbox x, y, w, h
            var h = dims[3];
            if (dims[0] != -1) {
                $(item).attr("style", "");
                $(item).children("br").remove();
                if ((lastyh != -1 && lasth != -1) 
                        && (y - (h * 0.75) > lastyh || lasth < (h * 0.75))) {
                    $(lastitem).append($("<br />")).append($("<br />"));
                }
                lastitem = item;                
                lastyh = y + h;
                lasth = h;
            }                        
        });
        pdiv.css("height", null);
    }

    // Horrid function to try and position lines how they would be on
    // the source material.  TODO: Make this not suck.
    this.positionByBounds = function() {
        var dims  = parseBoundingBoxAttr(pdiv.attr("bbox"));
        var scale = (pdiv.outerWidth(true)) / dims[2];
        var offx = pdiv.offset().left;
        var offy = pdiv.offset().top;
        pdiv.height(((dims[3] - dims[1]) * scale) + 20);

        var heights = [];
        var orderedheights = [];
        var orderedwidths = [];        

        pdiv.children(".ocr_line").each(function(position, item) {
            var lspan = $(item);
            var linedims = parseBoundingBoxAttr(lspan.attr("bbox"));
            var x = ((linedims[0] - dims[0]) * scale) + offx;
            var y = ((linedims[1] - dims[1]) * scale) + offy; 
            var w = (linedims[2] * scale);
            var h = (linedims[3] * scale);
            lspan.css("top",    y).css("left",   x)
                .css("position", "absolute");
            heights.push(h);
            orderedheights.push(h);
            orderedwidths.push(w);
        });

        var stats = new Stats(heights);
        pdiv.children(".ocr_line").each(function(position, item) {
            var lspan = $(item);
            var iheight = lspan.height();
            var iwidth = lspan.width();

            
            // if 'h' is within .25% of median, use the median instead    
            var h = orderedheights[position];
            if ((h / stats.median - 1) < 0.25) {
                h = stats.median;
            }
            // also clamp 'h' is min 3
            h = Math.max(h, 3);
            var w = orderedwidths[position];
            if (iheight < h && iheight) {
                while (iheight < h && iwidth < w) {
                    var cfs = parseInt(lspan.css("font-size").replace("px", ""));
                    lspan = lspan.css("font-size", (cfs + 1) + "px");
                    iheight = lspan.height();
                }
            } else if (iheight > h) {
                while (iheight && iheight > h) {
                    var cfs = parseInt(lspan.css("font-size").replace("px", ""));
                    lspan = lspan.css("font-size", (cfs - 1) + "px");
                    iheight = lspan.height();
                }
            }
        });       
    }
}
