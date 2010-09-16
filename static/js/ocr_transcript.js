// Class for showing a GUI for correcting transcripts of OCR batches
//


function OcrTranscript(insertinto_id, batch_id, initial) {
    var m_batch_id = batch_id;
    var m_page = initial || 0;

    var m_batchdata = null;

    // editor for each line
    var m_editor = new OcrLineEditor(insertinto_id);

    // spellchecker object
    var m_speller = new Spellchecker(".ocr_line");

    // copy of the latest state of the line text
    var m_textbuffer = null;

    // currently doing a spellcheck?
    var m_spellchecking = false;

    // page data cache
    var m_pagedata = null;

    // store the current line
    var m_currentline = null;

    // alias 'this' for use from within callbacks
    var self = this;

    // Ugh, keycodes
    var TAB = 9,
        S = 83,
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
            minHeight: 300,
            resize: function() {
                self.refreshSize();
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
    var m_scrollcontainer = $("<div></div>")
        .attr("id", "scroll_container");
    var m_pagediv = $("<div></div>")
        .addClass("waiting")
        .addClass("transcript_lines")
        .attr("id", "transcript_lines");
        //.css("min-height", m_container.height() - 45); 

    var m_footerheight = 25;

    this.init = function() {
        self.buildUi();
        self.refresh();
        self.refreshSize();
    }

    this.refresh = function() {
        setData();
    }

    this.refreshSize = function() {
        m_scrollcontainer
            .css("height", 
                    m_container.height() 
                    - m_speller.widgetHeight() 
                    - m_footerheight
            );
    }

    this.setHeight = function(newheight) {
        m_container.height(newheight);
        self.refreshSize();
            
    }

    this.container = function() {
        return m_container;
    }

    this.startSpellcheck = function() {
        var spellwidget = m_speller.init(m_container);
        m_container.append(spellwidget);
        m_scrollcontainer.height(
                m_scrollcontainer.height() - m_speller.widgetHeight());
        m_speller.spellCheck($(".ocr_line"));
        m_speller.takeFocus();
        m_spellchecking = true;
    }

    this.endSpellcheck = function() {
        var height = m_speller.widgetHeight();
        m_scrollcontainer.height(
                m_scrollcontainer.height() + height);
        $("#sp_container").remove();
        $(".badspell").each(function(i, elem) {
            $(elem).replaceWith($(elem).text());
        });
        m_spellchecking = false;
    }


    this.setBatchId = function(batch_id) {
        m_batch_id = batch_id;
        self.refresh();
    }

    this.setPage = function(page_index) {
        m_page = page_index || 0;
        self.refreshPageData();
    }

    this.setCurrentLineType = function(type) {
        if (!m_currentline.length)
            return;
        var newline = $("<" + type + "></" + type + ">")
            .data("bbox", m_currentline.data("bbox"))
            .data("num", m_currentline.data("num"))
            .addClass("ocr_line")
            .attr("class", m_currentline.attr("class"))
            .css("top", m_currentline.css("top"))
            .css("left", m_currentline.css("left"))
            .css("font-size", m_currentline.css("font-size"))
            .html(m_currentline.html());
        m_currentline.replaceWith(newline);
        m_currentline = newline;
        self.onTextChanged();
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

    m_speller.onWordCorrection = function() {
        if (m_pagediv.text() != m_textbuffer) {
            self.onTextChanged();
        }
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
        var url ="/batch/results/" + m_batch_id + "/" + m_page + "/"; 
        $.ajax({
            url: url,
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
                    if (m_spellchecking)
                        m_speller.spellCheck($(".ocr_line"));
                }               
            },
        });    
        self.onPageChange();
    }

    this.buildUi = function() {

        m_container.append(
                m_header.append(m_pagecount).append(m_pagename))
            .append(m_scrollcontainer.append(m_pagediv))
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
        if (!m_spellchecking && event.keyCode == TAB) {
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

    m_editor.onEditingStarted = function(element) {
        $("#sp_container").find("*").attr("disabled", true);
        if (m_spellchecking)
            m_speller.looseFocus();
    }

    m_editor.onEditingFinished = function(element) {
        $("#sp_container").find("*").attr("disabled", false);
        self.onTextChanged();
        if (m_spellchecking) {
            m_speller.spellCheck($(element));
            m_speller.takeFocus();
        }
    }

    m_editor.onEditNextElement = function() {
        var next = $(m_editor.element()).nextAll(".ocr_line").first();
        if (!next.length)
            next = $(".ocr_line").first();
        m_editor.setElement(next.get(0));
        next.trigger("click");
    }

    m_editor.onEditPrevElement = function() {
        var prev = $(m_editor.element()).prevAll(".ocr_line").first();
        if (!prev.length)
            prev = $(".ocr_line").last();
        m_editor.setElement(prev.get(0));
        prev.trigger("click");
    }

    
    $(window).bind("keyup.lineedit", function(event) {
        if (m_currentline && event.keyCode == F2) {
            m_editor.setElement(m_currentline, event);
        } else if (event.shiftKey && event.ctrlKey && event.keyCode == S) {
            if (m_spellchecking)
                self.endSpellcheck();
            else
                self.startSpellcheck();            
        }
        //else if (event.keyCode == KC_ESCAPE) {
        //    if (m_spellchecking)
        //        self.endSpellcheck();
        //}
    });

    $(".ocr_line").live("dblclick.editline", function(event) {
            
        if (!(m_editor.element() && m_editor.element() === this)) {
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
        self.onLineSelected(line.get(0).tagName.toLowerCase());
    }


    var setPageLines = function(data) {
        m_pagecount.text("Page " + (m_page + 1) + " of " + m_batchdata.extras.task_count);
        m_pagename.text(data.fields.page_name);
        m_pagediv.children().remove();
        m_pagediv.data("bbox", data.fields.results.box);
        $.each(data.fields.results.lines, function(linenum, line) {
            var type = line.type ? line.type : "span";
            lspan = $("<" + type + "></" + type + ">")
                .text(line.text)
                .addClass("ocr_line")
                .data("bbox", line.box)
                .data("num", line.line);
            m_pagediv.append(lspan);                        
        });
        //self.insertBreaks();
        m_textbuffer = m_pagediv.text();
        self.onLinesReady();
    }


    this.save = function() {
        var results = m_pagedata.fields.results;
        var lines = [];
        m_pagediv.find(".ocr_line").each(function(i, elem) {
            var line = {
                text: $(elem).text(),
                line: $(elem).data("num"),
                box:  $(elem).data("bbox"),
            };
            if (elem.tagName != "SPAN")
                line["type"] = elem.tagName.toLowerCase();
            lines.push(line);
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
                    m_textbuffer = m_pagediv.text();
                    self.onSave();
                }
            },
        });
    }
}

OcrTranscript.prototype.onLinesReady = function() {

}


OcrTranscript.prototype.onTextChanged = function() {

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

OcrTranscript.prototype.onSave = function() {

}


OcrTranscript.prototype.onLineSelected = function(linetype) {

}


OcrTranscript.prototype.onLineDeselected = function() {

}



