// Editing window for transcript texts

OCRJS.EditCommand = OCRJS.UndoCommand.extend({
    constructor: function(editor, elem, origtext, newtext) {
        this.base("Edit text");
        this.redo = function() {
            $(elem).html(newtext);
            editor.setCurrentLine(elem);
        };
        this.undo = function() {
            editor._logger("Undo for transcript editor");
            $(elem).html(origtext);
            editor.setCurrentLine(elem);
        };
    }
});


OCRJS.TranscriptEditor = OCRJS.OcrBaseWidget.extend({
    constructor: function(parent, options) {
        this.base(parent, options);
        this.options = {
            log: false,
        },
        $.extend(this.options, options);

        this._listeners = {
            onLinesReady: [],
            onTextChanged: [],
            onTaskLoad: [],
            onTaskChange: [],
            onClickPosition: [],
            onHoverPosition: [],
            onSave: [],
            onLineSelected: [],
            onLineDeselected: [],
        };

        this._task_pk = null;

        this._editor = new OCRJS.LineEditor(); // line editor widget
        this._speller = new OCRJS.Spellchecker(".ocr_line", {log: true}); // spell check widget
        this._undostack = new OCRJS.UndoStack(this);

        this._spellchecking = false;    // are we currently spell checking?...
        this._textbuffer = null;        // initial state of the text buffer
        this._pagedata = null;          // page data cache
        this._currentline = null;       // store the current line
        this._haschanges = false;       // unsaved pending changes

        this.init();
        this.setupMouseEvents();
        this.setupKeyEvents();
        this.setupCallbacks();        
        this.refreshSize();
    },


    init: function() {
        // UI bits it's useful to keep a reference to:
        this._container = $("<div></div>")
            .addClass("transcript_editor");
        this._scrollcontainer = $("<div></div>")
            .attr("id", "scroll_container");
        this._pagediv = $("<div></div>")
            .addClass("waiting")
            .addClass("transcript_lines")
            .attr("id", "transcript_lines");
        this._container
            .append(this._scrollcontainer.append(
                this._pagediv))
            .append(this._speller.init().hide())
            .appendTo(this.parent);
    },

    setupMouseEvents: function() {
        var self = this;

        $(".ocr_line").live("dblclick.editline", function(event) {
            if (!(self._editor.element() && self._editor.element() === this)) {
                self._editor.edit(this, event);
            }
        });

        $(".ocr_line").live("click.selectline", function(event) {
            self.setCurrentLine($(this));
        });

        $(".ocr_line").live("mouseover.selectline", function(event) {
            self.callListeners("onHoverPosition", $(this).data("bbox"));
        });
    },


    setupKeyEvents: function() {
        var self = this;

        $(window).bind("keydown.tabshift", function(event) {        
            if (!self._spellchecking && event.keyCode == KC_TAB) {
                var elem;
                if (self._currentline) {
                    elem = event.shiftKey
                        ? self._currentline.prevAll(".ocr_line").first()
                        : self._currentline.nextAll(".ocr_line").first();
                    if (elem.length == 0) {
                        elem = event.shiftKey
                            ? self._currentline.nextAll(".ocr_line").last()
                            : self._currentline.prevAll(".ocr_line").last();
                    }
                } else {
                    elem = event.shiftKey
                        ? $(".ocr_line", self._pagediv).last()                
                        : $(".ocr_line", self._pagediv).first();    
                }
                self.setCurrentLine(elem);
                return false;
            }
        });

        $(window).bind("keyup.lineedit", function(event) {
            if (self._currentline && event.keyCode == KC_F2) {
                self._editor.edit(self._currentline, event);
            } else if (event.ctrlKey && event.keyCode == 90) {
                if (!event.shiftKey) {
                    self._undostack.undo();
                } else {
                    self._undostack.redo();
                }
            } else if (event.shiftKey && event.ctrlKey && event.keyCode == 83) { // 's'
                if (self._spellchecking)
                    self.endSpellcheck();
                else
                    self.startSpellcheck();            
            }
            //else if (event.keyCode == KC_ESCAPE) {
            //    if (self._spellchecking)
            //        self.endSpellcheck();
            //}
        });
    },                 

    teardownMouseEvents: function() {
        $(".ocr_line")
            .die("dblclick.editline")
            .die("click.selectline")
            .die("mouseover.selectline");
    },

    teardownKeyEvents: function() {
        $(window)
            .unbind("keyup.lineedit")
            .unbind("keydown.tabshift");
    },                 

    disable: function() {
        this.teardownMouseEvents();
        this.teardownKeyEvents();
    },

    enable: function() {
        this.setupMouseEvents();
        this.setupKeyEvents();
    },             

    setupCallbacks: function() {
        var self = this;
        this._editor.addListener("onEditingStarted", function(element) {
            self.teardownKeyEvents();
            if (self._spellchecking)
                self._speller.looseFocus();
        });
        this._editor.addListener("onEditingFinished", function(element, origtext, newtext) {
            self.setupKeyEvents();
            self.replaceLineText(element, origtext, newtext);
            if (self._spellchecking) {
                self._speller.spellcheck($(element));
                self._speller.takeFocus();
            }
        });
        this._editor.addListener("onEditNextElement", function() {
            var next = $(self._editor.element()).nextAll(".ocr_line").first();
            if (!next.length)
                next = $(".ocr_line").first();
            self._editor.edit(next.get(0));
            next.trigger("click");
        });
        this._editor.addListener("onEditPrevElement", function() {
            var prev = $(self._editor.element()).prevAll(".ocr_line").first();
            if (!prev.length)
                prev = $(".ocr_line").last();
            self._editor.edit(prev.get(0));
            prev.trigger("click");
        });

        this._speller.addListener("onWordCorrection", function() {
            if (self._pagediv.text() != self._textbuffer) {
                self._textChanged();
            }
        });
        this._speller.addListener("onWordHighlight", function(element) {
            self.setCurrentLine($(element).parent());
        });        
    },                 

    container: function() {
        return this.containerWidget();
    },

    refreshSize: function() {
        this._scrollcontainer
            .css(
                "height", 
                this._container.height() 
                - this._speller.widgetHeight()
            );
    },

    setHeight: function(newheight) {
        this._container.height(newheight);
        this.refreshSize();
    },

    startSpellcheck: function() {
        this._speller.show();
        this.refreshSize();
        this._speller.spellcheck($(".ocr_line"));
        this._spellchecking = true;
    },

    endSpellcheck: function() {
        this._speller.hide();
        this.refreshSize();
        $(".badspell").each(function(i, elem) {
            $(elem).replaceWith($(elem).text());
        });
        this._spellchecking = false;
    },

    hasUnsavedChanges: function() {
        return this._haschanges;
    },        

    replaceLineText: function(element, origtext, newtext) {
        if (origtext != newtext) {
            this._undostack.push(
                    new OCRJS.EditCommand(this, element, origtext, newtext));
            this._textChanged(); 
        }           
    },

    taskId: function() {
        return this._task_pk;
    },                

    setTaskId: function(task_pk) {
        this._task_pk = task_pk;
        this.refresh();
    },

    setCurrentLineType: function(type) {
        if (!this._currentline.length)
            return;
        var newline = $("<" + type + "></" + type + ">")
            .data("bbox", this._currentline.data("bbox"))
            .data("num", this._currentline.data("num"))
            .addClass("ocr_line")
            .attr("class", this._currentline.attr("class"))
            .css("top", this._currentline.css("top"))
            .css("left", this._currentline.css("left"))
            .css("font-size", this._currentline.css("font-size"))
            .html(this._currentline.html());
        this._currentline.replaceWith(newline);
        this._currentline = newline;
        this._textChanged();        
    },

    // set a waiting spinner when doing something
    setWaiting: function(waiting) {
        this._pagediv.toggleClass("waiting", waiting);
    },

    taskData: function() {
        return this._taskdata;
    },                  

    refresh: function() {
        var self = this;                 
        $.ajax({
            url: "/ocr/task_transcript/" + self._task_pk + "/",
            dataType: "json",
            beforeSend: function(e) {
               self.setWaiting(true); 
            },
            complete: function(e) {
               self.setWaiting(false); 
            },
            success: function(data) {
                console.log("DATA: ", data);
                if (data == null) {
                    alert("Unable to retrieve page data.");
                } else if (data.error) {
                    alert(data.error);
                }
                self._taskdata = data[0];
                self.setPageLines(data[0]);              
                self.callListeners("onTaskLoad");
            },
            error: OCRJS.ajaxErrorHandler,
        });
    },


    setPageLines: function(data) {
        var self = this;
        this._pagediv.children().remove();
        this._pagediv.data("bbox", data.fields.results.box);
        $.each(data.fields.results.lines, function(linenum, line) {
            var type = line.type ? line.type : "span";
            var lspan = $("<" + type + "></" + type + ">")
                .attr("id", "line_" + line.line)
                .addClass("ocr_line");
            lspan
                .data("bbox", line.box);
            lspan
                .data("num", line.line);
            lspan.text(line.text);
            self._pagediv.append(lspan);
            console.log("appending ", lspan); 
        });
        //self.insertBreaks();
        this._textbuffer = this._pagediv.text();
        this.callListeners("onLinesReady");
    },


    save: function() {
        var self = this;
        var results = this._taskdata.fields.results;
        var lines = [];
        this._pagediv.find(".ocr_line").each(function(i, elem) {
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
            url: "/ocr/save/" + this._task_pk + "/",
            data: {data: JSON.stringify(results)},
            dataType: "json",
            type: "POST",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                if (data && data.ok) {
                    self._textbuffer = self._pagediv.text();
                    self._haschanges = false;
                    self.callListeners("onSave");
                }
            },
        });
    },


    setCurrentLine: function(line) {
        line = $(line);                        
        this._currentline = line;
        $(".ocr_line", this._pagediv).removeClass("hover");
        line.addClass("hover");
        var pos = this.isScrolledIntoView(line.get(0));
        if (pos != 0) {
            line.get(0).scrollIntoView(pos == -1);
        }        
        this.callListeners("onClickPosition", line.data("bbox"));
        this.callListeners("onLineSelected", line.get(0).tagName.toLowerCase());
    },
                 

    // check is an element is visible - returns -1 if the elem
    // is above the viewport, 0 if visible, 1 if below
    isScrolledIntoView: function(elem) {
        if (!elem)
            return 0;            
        var docviewtop = this._scrollcontainer.scrollTop();
        var docviewbottom = docviewtop + this._scrollcontainer.height();
        var elemtop = $(elem).offset().top;
        var elembottom = elemtop + $(elem).height();
        if (elembottom > docviewbottom) 
            return 1;
        if (elemtop < docviewtop) 
            return -1;
        return 0;
    },


    _textChanged: function() {
        this._haschanges = true;
        this.callListeners("onTextChanged");
    },                      

    /*
     * Overridable events
     *
     */
                 
    onLinesReady: function() {
    },

    onTextChanged: function() {
    },

    onTaskLoad: function() {
    },

    onTaskChange: function() {
    },

    onClickPosition: function(position) {
    },

    onHoverPosition: function(position) {
    },

    onSave: function() {
    },

    onLineSelected: function(linetype) {
    },

    onLineDeselected: function() {
    },




});
