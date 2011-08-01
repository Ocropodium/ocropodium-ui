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
        this.parent = parent;
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
        this._bboxre = /bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
        this._indexre = /(\d+)$/;
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
        this.resetSize();

        // convenience functions
        this.parseBbox = OCRJS.Hocr.parseBbox;
        this.parseIndex = OCRJS.Hocr.parseIndex;
    },


    init: function() {
        // UI bits it's useful to keep a reference to:
        this._scrollcontainer = $("<div></div>")
            .attr("id", "innerscroll");
        this._pagediv = $("<div></div>")
            .addClass("waiting")
            .addClass("transcript_lines")
            .attr("id", "transcript_lines");
        $(this.parent)
            .append(this._scrollcontainer.append(
                this._pagediv))
            .append(this._speller.init().hide());
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
            self.callListeners("onHoverPosition", self.parseBbox($(this)));
        });
    },


    setupKeyEvents: function() {
        var self = this;
        
        $(window).bind("keydown.tabshift", function(event) {        
            var first = self.parseIndex($(".ocr_line", self._pagediv).first()),
                last = self.parseIndex($(".ocr_line", self._pagediv).last());
            if (!self._spellchecking && event.keyCode == KC_TAB) {
                var elem;
                if (self._currentline) {
                    var index = self.parseIndex(self._currentline);                    
                    elem = event.shiftKey
                        ? $("#line_" + (index - 1))
                        : $("#line_" + (index + 1));
                    if (elem.length == 0) {
                        elem = event.shiftKey
                            ? $("#line_" + last)
                            : $("#line_" + first);
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

    resetSize: function() {
        this._scrollcontainer
            .css(
                "height", 
                $(this.parent).height() 
                - this._speller.widgetHeight()
            );
    },

    startSpellcheck: function() {
        this._speller.show();
        this.resetSize();
        this._speller.spellcheck($(".ocr_line"));
        this._spellchecking = true;
    },

    endSpellcheck: function() {
        this._speller.hide();
        this.resetSize();
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

    // set a waiting spinner when doing something
    setWaiting: function(waiting) {
        this._pagediv.toggleClass("waiting", waiting);
    },

    taskData: function() {
        return this._task_pk;
    },                  

    refresh: function() {
        var self = this;                 
        this._pagediv.load("/ocr/task_transcript/" + self._task_pk + " .ocr_page:first", 
                null, function(text) {
                    self.setWaiting(false);
                    self.callListeners("onTaskLoad");
                    self.setPageLines();
        });
    },

    setPageLines: function() {
        this._textbuffer = this._pagediv.text();
        this.callListeners("onLinesReady");
    },

    getData: function() {
        var hover = $(".ocr_line.hover", this._pagediv);
        hover.removeClass("hover");
        var data = this._pagediv.html();
        hover.addClass("hover");
        return data;
    },

    setCleanState: function() {
        this._textbuffer = this._pagediv.text();
        this._haschanges = false;
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
        this.callListeners("onClickPosition", this.parseBbox(line));
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
