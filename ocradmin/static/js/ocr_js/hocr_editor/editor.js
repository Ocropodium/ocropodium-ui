

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
            $(elem).html(origtext);
            editor.setCurrentLine(elem);
        };
    }
});

HE.DeleteLineCommand = OcrJs.UndoCommand.extend({
    init: function(editor, line) {
        this._super("Delete paragraph");
        var prev = line.prev(),
            next = line.next(),
            parent = line.parent();
        this.redo = function() {
            line.detach();
        };
        this.undo = function() {
            if (prev.length > 0)
                prev.after(line);
            else if (next.length > 0)
                next.after(line);
            else
                parent.append(line);
        };
    }
});



HE.Editor = OcrJs.Base.extend({
    init: function(parent, cmdstack, options) {
        this._super(parent);

        this.parent = parent;

        this._listeners = {
            clickPosition: [],
            hoverPosition: [],
            lineSelected: [],
            lineDeselected: [],
            startEditing: [],
            stopEditing: [],
       };
        this._undostack = cmdstack;

        this._hocr = new HE.HocrDoc(parent);

        this._currentline = null;

        this.setupEvents();
    },

    currentLine: function() {
        return this._currentline;
    },

    getData: function() {
        var hover = $(".ocr_line.hover"),
        editing = $(".ocr_line.editing");
        hover.removeClass("hover");
        editing.removeClass("editing");

        var data = $("#transcript").html();
        hover.addClass("hover");
        editing.addClass("editing");
        return data;
    },

    resetSize: function() {

    },

    setWaiting: function(waiting) {
        $(this.parent).toggleClass("waiting", waiting);
    },

    setupEvents: function() {
        var self = this;

        $(".ocr_line").live("dblclick.editline", function(event) {
            self._hocr.setCurrent(this);
            self.setCurrentLine(this);
            self.editLine(this);
        });

        $(".ocr_line").live("click.selectline", function(event) {
            self._hocr.setCurrent(this);
            self.setCurrentLine(this);
        });

        $(".ocr_line").live("mouseover.selectline", function(event) {
            self.trigger("hoverPosition", self._hocr.parseBbox($(this)));
        });
    },

    cmdReplaceLineText: function(element, origtext, newtext) {
        if (origtext != newtext) {
            this._undostack.push(
                    new HE.EditCommand(this, element, origtext, newtext));
        }
    },

    cmdDeleteLine: function() {
        this._undostack.push(
            new HE.DeleteLineCommand(this, this.currentLine()));        
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
        line.focus();
        this._hocr.setCurrent(line.get(0));
        $(".ocr_line", this._pagediv).removeClass("hover");
        line.addClass("hover").focus();
        var pos = this.isScrolledIntoView(line.get(0));
        if (pos != 0) {
            line.get(0).scrollIntoView(pos == -1);
        }
        this.trigger("clickPosition", this._hocr.parseBbox(line));
        this.trigger("lineSelected");
    },

    editLine: function(element) {
        element = element || this._currentline;
        this.trigger("startEditing", element);        
        $(element)
            .find("*").addClass("selectable").end()
            .addClass("selectable editing")
            .focus().prop("contentEditable",true).click();

    },

    finishEditing: function(element, initialcontent, save, blur) {
        $(element)
            .find("*").removeClass("selectable").end()
            .removeClass("selectable editing")
            .unbind(".finishedit")
            .removeAttr("contentEditable");
        // if the editing wasn't terminated by a blur of the element,
        // trigger a blur and way since this seems to be the only
        // was to force Firefix and Chrome to remove the contentEditable
        // styling from the line
        if (!blur)
            $(element).blur();
        if (save)
            this.cmdReplaceLineText(element, initialcontent, $(element).html());
        else
            $(element).html(initialcontent);
        this.trigger("stopEditing", element);
    },

    refresh: function() {
        this._hocr.reset();
    },

    _setCaretAfter: function(el) {
        var sel, range;
        if (window.getSelection && document.createRange) {
            range = document.createRange();
            //range.setStartAfter(el);
            range.collapse(true);
            sel = window.getSelection(); 
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(el);
            range.collapse(false);
            range.select();
        }
    },
});
