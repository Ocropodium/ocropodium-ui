

var OcrJs = OcrJs || {};
    
OcrJs.HocrEditor = OcrJs.HocrEditor || {};

var HE = OcrJs.HocrEditor;

HE.EditCommand = OcrJs.UndoCommand.extend({
    init: function(editor, elem, origtext, newtext) {
        this._super("Edit text");
        this.redo = function() {
            $(elem).html(newtext);
            editor.setCurrentLine(elem);
        };
        this.undo = function() {
            console.log("Undo for transcript editor");
            $(elem).html(origtext);
            editor.setCurrentLine(elem);
        };
    }
});



HE.Editor = OcrJs.Base.extend({
    init: function(parent, cmdstack, options) {
        this._super(parent);

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
            onEditLine: [],
        };
        this._undostack = cmdstack;

        this._hocr = new HE.HocrDoc(parent);

        this.setupEvents();
    },

    resetSize: function() {

    },

    setWaiting: function(waiting) {
        $(parent).toggleClass("waiting", waiting);
    },

    setupEvents: function() {
        var self = this;

        $(window).bind("keydown.tabshift", function(event) {
            if (!self._spellchecking && event.keyCode == KC_TAB) {
                console.log("Called forward");
                event.shiftKey ? self.backward() : self.forward();
                event.stopPropagation();
                event.preventDefault();
            } else if (self._currentline && event.keyCode == KC_F2) {
                self.trigger("onEditLine", self._currentline);
            } 
        });

        $(".ocr_line").live("dblclick.editline", function(event) {
            self.trigger("onEditLine", this);
        });

        $(".ocr_line").live("click.selectline", function(event) {
            self._hocr.setCurrent(this);
            self.setCurrentLine(this);
        });

        $(".ocr_line").live("mouseover.selectline", function(event) {
            self.trigger("onHoverPosition", self._hocr.parseBbox($(this)));
        });
    },

    cmdReplaceLineText: function(element, origtext, newtext) {
        if (origtext != newtext) {
            this._undostack.push(
                    new HE.EditCommand(this, element, origtext, newtext));
        }
    },

    forward: function() {
        var line = this._hocr.nextLine();
        if (!line)
            line = this._hocr.firstLine();
        this.setCurrentLine(line);
    },

    backward: function() {
        var line = this._hocr.prevLine();
        if (!line)
            line = this._hocr.lastLine();
        this.setCurrentLine(line);
    },

    // check is an element is visible - returns -1 if the elem
    // is above the viewport, 0 if visible, 1 if below
    isScrolledIntoView: function(elem) {
        if (!elem)
            return 0;
        var docviewtop = $(this.parent).scrollTop();
        var docviewbottom = docviewtop + $(this.parent).height();
        var elemtop = $(elem).offset().top;
        var elembottom = elemtop + $(elem).height();
        if (elembottom > docviewbottom)
            return 1;
        if (elemtop < docviewtop)
            return -1;
        return 0;
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
        this.trigger("onClickPosition", this._hocr.parseBbox(line));
        this.trigger("onLineSelected", line.get(0).tagName.toLowerCase());
    },

    refresh: function() {
        this._hocr.reset();
    },
});
