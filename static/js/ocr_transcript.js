// Class for showing a GUI for correcting transcripts of OCR batches
//


function OcrTranscript(insertinto_id, batch_id) {
    var m_batch_id = batch_id;
    var m_page = 0;

    var m_batchdata = null;

    // editor for each line
    var m_editor = new OcrLineEditor(insertinto_id); 

    // page data cache
    var m_pagedata = null;

    // store the current line
    var m_currentline = null;

    // alias 'this' for use from within callbacks
    var self = this;

    // Ugh, keycodes
    var TAB = 9,
        F2 = 113;


    // UI bits it's useful to keep a reference to:
    var m_container = $("<div></div>")
        .addClass("widget")
//        .css("width", "400px")
//        .css("height", "200px")
//        .draggable({
//            stack: ".widget",
//            snap: "#workspace",
//            handle: "#batch_head",
         .resizable({
            minWidth: 300,
            resize: function(e, ui) {
                $("#scroll_container")
                    .css("height", $(this).height() - 45);
            },        
        }); //.sortable({connectWith: ".widget"});  
    var m_header = $("<div></div>")
        .addClass("batch_head")
        .addClass("widget_header")
        .attr("id", "batch_head")
        .text("OCR Batch");
    var m_pagename = $("<span></span>")
        .attr("id", "page_name");
    var m_pagecount = $("<span></span>")
        .attr("id", "page_count");
    var m_scroller = $("<div></div>")
        .attr("id", "scroll_container");
    var m_pagediv = $("<div></div>")
        .addClass("waiting")
        .addClass("transcript_lines")
        .attr("id", "transcript_lines");
        //.css("min-height", m_container.height() - 45); 


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
        m_pagediv.toggleClass("waiting", waiting);
    }

    this.page = function() {
        return m_page;
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
        self.onPageChange();
    }

    this.buildUi = function() {

        m_container.append(
                m_header.append(m_pagecount).append(m_pagename))
            .append(m_scroller.append(m_pagediv))
            .appendTo("#" + insertinto_id);
    }


    /*
     *  Events
     */

//    m_batchdiv.bind("mouseup", function(event) {
//        var sel = window.getSelection();
//        if (sel.toString() == "" || sel.rangeCount > 1)
//            return;
//
//        var elem = $(sel.baseNode.parentElement);
//        $(document).bind("keydown.lineedit", function(e) {
//            if (e.which == 27) { // escape
//                alert("escape");
//                $(document).unbind(".lineedit");
//                return false;
//            } else if (e.which == 13) {
//                alert("return");
//                $(document).unbind(".lineedit");
//                return false;
//            } else {
//                alert(e.which);
//            }
//        });
//    });

    $(window).bind("keydown.tabshift", function(event) {        
        if (event.keyCode == TAB) {
            var elem;
            if (m_currentline) {
                elem = event.shiftKey
                    ? m_currentline.prevAll(".ocr_line").first()
                    : m_currentline.nextAll(".ocr_line").first();
                if (elem.length == 0) {
                    elem = event.shiftKey
                        ? m_currentline.nextAll(".ocr_line").last()
                        : m_currentline.prevAll(".ocr_line").last();
                }
            } else {
                elem = event.shiftKey
                    ? m_pagediv.find(".ocr_line").last()                
                    : m_pagediv.find(".ocr_line").first();    
            }
            setCurrentLine(elem);
            return false;
        }
    });

    m_editor.onEditNextElement = function() {
        var next = m_editor.element().nextAll(".ocr_line").first();
        if (!next.length)
            next = $(".ocr_line").first();
        m_editor.setElement(next.get(0));
        next.trigger("click");
    }

    m_editor.onEditPrevElement = function() {
        var prev = m_editor.element().prevAll(".ocr_line").first();
        if (!prev.length)
            prev = $(".ocr_line").last();
        m_editor.setElement(prev.get(0));
        prev.trigger("click");
    }


    $(window).bind("keyup.lineedit", function(event) {
        if (m_currentline && event.keyCode == F2) {
            m_editor.setElement(m_currentline, event);
        }        
    });

//    $(".ocr_line").live("mouseover.hoverline mouseout.hoverline", function(event) {
//        if (event.type == "mouseover") {
//            $(this).addClass("hover");
//        } else {
//            $(this).removeClass("hover");
//        }
//    });

    $(".ocr_line").live("dblclick.editline", function(event) {
            
        if (!(m_editor.element() && m_editor.element().get(0) === this)) {
            m_editor.setElement(this, event);
        }
    });

    $(".ocr_line").live("click", function(event) {
        setCurrentLine($(this));
    });

    $(".ocr_line").live("mouseover", function(event) {
        self.onHoverPosition($(this).data("bbox"));
    });


    // check is an element is visible - returns -1 if the elem
    // is above the viewport, 0 if visible, 1 if below
    var isScrolledIntoView = function(elem) {
        var docviewtop = $("#scroll_container").scrollTop();
        var docviewbottom = docviewtop + $("#scroll_container").height();

        var elemtop = $(elem).offset().top;
        var elembottom = elemtop + $(elem).height();
        if (elembottom > docviewbottom) 
            return 1;
        if (elemtop < docviewtop) 
            return -1;
        return 0;
    }


    var setCurrentLine = function(line) {
        m_currentline = line;
        $(".ocr_line").removeClass("hover");
        line.addClass("hover");
        var pos = isScrolledIntoView(line.get(0));
        if (pos != 0) {
            line.get(0).scrollIntoView(pos == -1);
        }        
        self.onClickPosition(line.data("bbox"));
    }


    var setPageLines = function(data) {
        m_pagecount.text("Page " + (m_page + 1) + " of " + m_batchdata.extras.task_count);
        m_pagename.text(data.fields.page_name);
        m_pagediv.children().remove();
        m_pagediv.data("bbox", data.fields.results.box);
        $.each(data.fields.results.lines, function(linenum, line) {
            lspan = $("<span></span>")
                .text(line.text)
                .addClass("ocr_line")
                .data("bbox", line.box)
                .data("num", line.line);
            m_pagediv.append(lspan);                        
        });
        self.insertBreaks();
    }


    this.save = function() {
        var results = m_pagedata.fields.results;
        var lines = [];
        m_pagediv.find(".ocr_line").each(function(i, elem) {
            lines.push({
                text: $(elem).text(),
                line: $(elem).data("num"),
                box:  $(elem).data("bbox"),
            });
        });
        results.lines = lines;
        $.ajax({
            url: "/batch/save/" + m_batch_id + "/" + m_page + "/", 
            data: {data: JSON.stringify(results)},
            dataType: "json",
            type: "POST",
            error: function(e) {
                alert("Error saving data: " + e);
            },
            success: function(data) {
                if (data && data.ok) {
                    alert("Saved ok!");
                }
            },
        });
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
        // insert space between each line
        $("<span></span>").text("\u00a0").insertBefore(
        m_pagediv.find(".ocr_line").first().nextAll());

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
                    $(lastitem).after($("<br />")).after($("<br />"));
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


OcrTranscript.prototype.onPageChange = function() {


}


OcrTranscript.prototype.onClickPosition = function(position) {


}


OcrTranscript.prototype.onHoverPosition = function(position) {


}



