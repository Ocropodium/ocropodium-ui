// Class for showing a GUI for correcting transcripts of OCR batches
//


function OcrTranscript(insertinto_id, batch_id) {
    var m_batch_id = batch_id;
    var m_page = 0;

    var m_batchdata = null;

    // editor for each line
    var m_editor = null;

    // page data cache
    var m_pagedata = null;

    // alias 'this' for use from within callbacks
    var self = this;

    // UI bits it's useful to keep a reference to:
    var m_container = $("<div></div>")
        .addClass("widget");  
    var m_header = $("<div></div>")
        .addClass("batch_head")
        .addClass("widget_header")
        .attr("id", "batch_head")
        .text("OCR Batch");
    var m_batchdiv = $("<div></div>")
        .addClass("ocr_transcript")
        .addClass("waiting")
        .attr("id", "ocr_transcript");
    var m_pagediv = $("<div></div>")
        .addClass("transcript_lines"); 


    this.init = function() {
        self.buildUi();
        self.refresh();
    }

    this.refresh = function() {
        setData();
    }

    this.setBatchId = function(batch_id) {
        m_batch_id = batch_id;
        self.refresh();
    }

    this.setPage = function(page_index) {
        m_page = page_index;
        self.refreshPageData();
    }

    // set a waiting spinner when doing something
    this.setWaiting = function(waiting) {
        m_batchdiv.toggleClass("waiting", waiting);
    }

    this.pageCount = function() {
        return m_batchdata.extras.task_count;
    }

    this.pageData = function() {
        return m_pagedata;
    }

    this.refresh = function() {
        $.ajax({
            url: "/batch/results/" + m_batch_id + "/?start=" + m_page + "&end=" + (m_page + 1),
            dataType: "json",
            beforeSend: function(e) {
               self.setWaiting(true); 
            },
            complete: function(e) {
               self.setWaiting(false); 
            },
            success: function(data) {
                if (data == null) {
                    alert("Unable to retrieve page data.");
                } else if (data.error) {
                    alert(data.error);
                }
                m_batchdata = data[0];
                self.onBatchLoad();              
                self.refreshPageData();
            },
        });
    }

    
    this.refreshPageData = function() {
        $.ajax({
            url: "/batch/results/" + m_batch_id + "/" + m_page + "/",
            data: {},
            dataType: "json",
            beforeSend: function(e) {
               self.setWaiting(true); 
            },
            complete: function(e) {
               self.setWaiting(false); 
            },
            success: function(data) {
                if (data == null) {
                    alert("Unable to retrieve page data.");
                } else if (data.error) {
                    alert(data.error);
                } else if (data.length != 1) {
                    alert("Data length error - should be 1 element long");
                } else {
                    m_pagedata = data[0];
                    self.onPageLoad();
                    setPageLines(data[0]);
                }               
            },
        });    
    }

    this.buildUi = function() {

        m_container.append(m_header).append(m_batchdiv.append(m_pagediv)).appendTo("#" + insertinto_id);
    }


    /*
     *  Events
     */

    $(".ocr_line").live("mouseover mouseout", function(event) {
        if (event.type == "mouseover") {
            $(this).addClass("hover");
        } else {
            $(this).removeClass("hover");
        }
    });

    $(".ocr_line").live("click", function(event) {
        if (m_editor == null) {
            m_editor = new OcrLineEditor(insertinto_id);
            m_editor.init();
            m_editor.setElement(this);
        } else {
            m_editor.setElement(this);
        }
    });


    var setPageLines = function(data) {
        m_pagediv.find(".ocr_line").remove();
        m_pagediv.data("bbox", data.results.box);
        $.each(data.results.lines, function(linenum, line) {
            lspan = $("<span></span>")
                .text("  " + line.text)
                .addClass("ocr_line")
                .data("bbox", line.box);
            m_pagediv.append(lspan);                        
        });
        self.insertBreaks();
    }



    //
    // Layout: Functions for arranging the lines in certain ways
    // TODO: Remove code dup between this and the ocr_page.js
    // file.
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
        m_pagediv.removeClass("literal");
        m_pagediv.children(".ocr_line").each(function(lnum, item) {
            var dims = $(item).data("bbox");
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
        m_pagediv.css("height", null);
    }

    var resizeToTarget = function(span, targetheight, targetwidth) {
        var iheight = span.height();
        var iwidth = span.width();
        var count = 0
        if (iheight < targetheight && iheight) {
            //alert("grow! ih: " + iheight + " th: " + targetheight);
            while (iheight < targetheight && iwidth < targetwidth) {
                var cfs = parseInt(span.css("font-size").replace("px", ""));
                span = span.css("font-size", (cfs + 1) + "px");
                iheight = span.height();
                count++;
                if (count > 50) {
                    //alert("growing too long: iheight: " + iheight + " th: " + targetheight);
                    break;
                }
            }
        } else if (iheight > targetheight) {
            while (iheight && iheight > targetheight) {
                var cfs = parseInt(span.css("font-size").replace("px", ""));
                span = span.css("font-size", (cfs - 1) + "px");
                iheight = span.height();
                //alert("ih: " + iheight + " fs:" + cfs + " th: " + targetheight);
                //alert("iheight: " + iheight + " fs: " + span.css("font-size") + " cfs: " + (cfs - 1));
                count++;
                if (count > 50) {
                    //alert("shrinking too long: iheight: " + iheight + " th: " + targetheight);
                    break;
                }
            }
        }
        return span.css("font-size");
    }


    // Horrid function to try and position lines how they would be on
    // the source material.  TODO: Make this not suck.
    this.positionByBounds = function() {

        var dims  = m_pagediv.data("bbox");
        var scale = (m_pagediv.outerWidth(true)) / dims[2];
        var offx = m_pagediv.offset().left;
        var offy = m_pagediv.offset().top;
        m_pagediv.height(((dims[3] - dims[1]) * scale) + 20);

        var heights = [];
        var orderedheights = [];
        var orderedwidths = [];        

        m_pagediv.addClass("literal");
        m_pagediv.children(".ocr_line").each(function(position, item) {
            $(item).children("br").remove();
            var lspan = $(item);
            var linedims = lspan.data("bbox");
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
        var medianfs = null;
        m_pagediv.children(".ocr_line").each(function(position, item) {
            //var lspan = $(item);
            //var iheight = lspan.height();
            //var iwidth = lspan.width();
            
            // if 'h' is within .25% of median, use the median instead    
            var h = orderedheights[position];
            var w = orderedwidths[position];
            var ismedian = false;
            if ((h / stats.median - 1) < 0.25) {
                h = stats.median;
                ismedian = true;
            } 

            // also clamp 'h' is min 3
            h = Math.max(h, 3);
            if (medianfs != null && ismedian) {
                $(item).css("font-size", medianfs);
            } else {            
                var fs = resizeToTarget($(item), h, w);
                if (medianfs == null && ismedian) {
                    medianfs = fs;
                }
            }
        });       
    }

}


OcrTranscript.prototype.onBatchLoad = function() {


}


OcrTranscript.prototype.onPageLoad = function() {


}


