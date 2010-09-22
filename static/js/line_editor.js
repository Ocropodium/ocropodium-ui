// Make a span editable.  Second attempt


// test code
var editor = null;
$(function() {

    editor = new OCRJS.LineEditor();        

    $(window).bind("keyup.lineedit", function(event) {
        var line = $(".ocr_line").first().get(0);
        if (event.keyCode == 113) {
            editor.edit(line, event);
        }
    });
});

if (OCRJS === undefined) {
    var OCRJS = {};
}


/*
 * Undo Commands for insert/delete
 *
 */

// Undoable commands - note that these depend
// on the outer object scope, which is not ideal
var InsertCommand = OCRJS.UndoCommand.extend({
    constructor: function(editor, char, curr) {
        this.base("typing");
        this.editor = editor;
        this.curr = curr;
        this.char = char;
        var self = this;
        this.redo = function() {
            $(self.char).insertBefore(self.curr);
            self.editor.setCurrentChar(self.curr);
        };
        this.undo = function() {
            $(self.char).remove();
            self.editor.setCurrentChar(self.curr);
        };
        this.mergeWith = function(other) {
            self.char = $(self.char).add(other.char).get();                    
            return true;                
        };
    },
});

var DeleteCommand = OCRJS.UndoCommand.extend({
    constructor: function(editor, elems, nexts, back) {
        this.base("delete");
        this.editor = editor;
        this.elems = elems;
        this.nexts = nexts;
        this.back = back;
        var self = this;
        this.redo = function() {
            $(self.elems).not(".endmarker").detach();
            self.editor.setCurrentChar(self.nexts[0]);
        };
        this.undo = function() {
            for (var i in self.elems) {
                $(self.elems[i]).insertBefore(self.nexts[i]);
                self.editor.setCurrentChar(self.back 
                        ? self.elems[i].nextElementSibling : self.elems[i]);
            }
        };
        this.mergeWith = function(other) {
            for (var i in other.elems) {
                self.elems.push(other.elems[i]);
                self.nexts.push(other.nexts[i]);
            }
            return true;    
        };
    },
});


const LONGKEY = 500;
OCRJS.LineEditor = Base.extend({

    _e: null,          // the element we're operating on 
    _c: null,          // the current character in front of the cursor
    _top: null,         // reference to initial top of elem
    _left: null,        // reference to initial left of elem 
    _selectstart: null,   // selection start & end  
    _inittext: null,      // initial text of selected element 
    _keyevent: null,      // capture the last key event 
    _blinktimer: -1,      // timer for cursor flashing
    _dragpoint: null,     // the point dragging started 
    _undostack: new OCRJS.UndoStack(this), // undo stack object 
    _cursor: $("<div></div>") // cursor element
            .addClass("editcursor")
            .text("|").get(0),
    _endmarker: $("<div></div>")  // anchor for the end of the line 
            .addClass("endmarker").get(0),


    blinkCursor: function(blink) {
        var self = this;
        if (blink) {
            $(this._cursor).toggleClass("blink");
            this._blinktimer = setTimeout(function() {
                self.blinkCursor(true);        
            }, LONGKEY);
        } else {
            clearTimeout(this._blinktimer);
            this._blinktimer = -1;
        }
    },


    /*
     * Setup and teardown functions
     *
     */

    edit: function(elem, event) {
        this._e = elem;
        this._top = $(elem).offset().top;
        this._left = $(elem).offset().left;
        this._inittext = $(elem).text();        

        this.setupEvents()

        // wrap a span round each char
        $(this._e).html($.map($.trim($(this._e).text()), function(ch) {
            return "<span>" + ch + "</span>";
        }).join("")).append(
            $(this._endmarker).height($(this._e).height())
        );

        $(elem).addClass("selected");    
        $(elem).addClass("editing");

        this._initialiseCursor();
        //this.selectCharUnderClick(event);
    },

    finishEditing: function(withtext) {
        $(this._e)
            .removeClass("selected")
            .removeClass("editing")        
            .html(withtext ? withtext : $(this._e).text());
        this._c = null;
        this._e = null;
        this._selectstart = null;        
        this.blinkCursor(false);
        $(this._cursor).remove();

        this.teardownEvents();
    },

    setCurrentChar: function(charelem) {
        if (!$.inArray(this._e.children, charelem))
            throw "Char element is not a childen of line";

        this._c = charelem;
        this.positionCursorTo(this._c);
    },                   

    setupEvents: function() {
        var self = this;
        var elem = this._e;

        // set up a click handler for the window
        // if we click outside the current element, 
        // close the editor and unbind the click
        $(window).bind("click.editorblur", function(event) {
            var left = $(elem).offset().left;
            var top = $(elem).offset().top;
            var width = $(elem).outerWidth();
            var height = $(elem).outerHeight();

            if (!(event.pageX >= left 
                    && event.pageX <= (left + $(elem).width())
                    && event.pageY >= top
                    && event.pageY <= (top + $(elem).height()))) {
                self.finishEditing();
            }
        });

        $(window).bind("keydown.editortype", function(event) {
            if (self._handleKeyEvent(event)) {
                event.preventDefault();
                return false;
            }
            self._logger(event.type + ": " + event.keyCode + "  Char: " + event.charCode);
            //alert(typeof event.which);
        });

        $(window).bind("keypress.editortype", function(event) {
            if (self._handleKeyEvent(event)) {
                event.preventDefault();
                return false;
            }
            self._logger(event.type + ": " + event.keyCode + "  Char: " + event.charCode);
            //alert(typeof event.which);
        });




    },

    teardownEvents: function() {
        $(window).unbind("click.editorblur");
        $(this._e).children()
            .die("click.clearselect")
            .die("click.positioncursor");
        $(this._e)
            .unbind("dblclick.selectword")
            .unbind("mousedown.noselection")
            .unbind("mousemove.selecttext")
            .unbind("mouseup.textsel");
        $(window)
            .unbind("click.editorblur")
            .unbind("keydown.editortype")
            .unbind("keypress.editortype")
            .unbind("keyup.editortype")
            .unbind("mousemove.noselection")
            .unbind("mouseup.checkselection")
            .unbind("mouseup.selecttext");
    },


    /*
     * Cursor navigation and positioning functions                    
     *
     */

    // when at the end of the line, the current
    // char is the endmarker div.  This should
    // never be deleted                    
    isAtEnd: function() {
        return this._c.tagName == "DIV";
    },
                    
    moveCursorLeft: function() {
        // check if we're at the end
        // or at the beginning...
        if (!this._c.previousElementSibling)
            return;
        this.setCurrentChar(this._c.previousElementSibling);
        return true;
    },

    moveCursorRight: function() {
        if (this.isAtEnd())
            return false;
        this.setCurrentChar(this._c.nextElementSibling);
        return true;
    },

    moveCursorToStart: function() {
        this.setCurrentChar(this._e.children[0]);
    },                   

    moveCursorToEnd: function() {
        this.setCurrentChar(this._endmarker);
    },

    positionCursorTo: function(elem) {
        if (!elem)
            throw "Attempt to position cursor to null element";
        var mintop = this._top; //$(this._e).offset().top;
        var minleft = this._left; //$(this._e).offset().left;
        // anchor to either the prev element or the parent.  This is to
        // hack around the fact that breaking chars (spaces) in Webkit
        // seem to have no position
        if (elem && elem.previousElementSibling) {
            var prev = $(elem.previousElementSibling);
            mintop = Math.max(mintop, prev.offset().top);
            minleft = Math.max(minleft, prev.offset().left
                   + prev.width());
        }
        // if there's no char elem, set to back of
        // the container box
        if (elem.tagName == "DIV") {
            //this._logger("Positioninging by end");
            var top = $(this._endmarker).offset().top;
            var left = ($(this._endmarker).offset().left);
            // hack around Firefox float drop bug
            if ($.browser.mozilla) {
                if (this._e.children > 1) {
                    top = $(this._e).children().slice(-2).offset().top;
                } else {
                    top = ($(this._e).offset().top + $(this._e).height()) - $(this._endmarker).height();
                }               
            }
            $(this._cursor)
                .css("top", Math.max(top, mintop) + "px")
                .css("left", Math.max(left, minleft) + "px");
            return;
        }

        var top = Math.max(mintop, $(elem).offset().top);
        var left = Math.max(minleft, $(elem).offset().left);
        $(this._cursor).css("top", top + "px").css("left", left + "px");
    },


    /*
     * Selection functions
     *
     */

    deselectAll: function() {
        this._selectstart = null;
        var done = $(this._e).children(".sl").length > 0;
        $(this._e).children().removeClass("sl");
        return done;
    },

    updateSelection: function(start, end) {
        if (start == end) {
            $(this._e).children().removeClass("sl");
            return;
        }
        var gotstart = false;
        for (var i = 0; i < this._e.childElementCount; i++) {         
            if (this._e.children[i] == start || this._e.children[i] == end) {
                gotstart = !gotstart;
            }
            $(this._e.children[i]).toggleClass("sl", gotstart);
        }
    },


    /*
     * Editing Function
     *
     */
    deleteChar: function(back) {
        if (this.eraseSelection())
            return;

        // if we're already at the end, return
        if (!back && !this._c)
            return;

        // if we're at the beginning, return
        if (back && this._c && !this._c.previousElementSibling)
            return;

        // if we're at the end and backspacing, move back and delete
        if (back && !this._c && $(this._e).children("span").length) {
            back = false;
            this._c = $(this._e).children("span").last().get(0);
        }

        var next = back ? this._c : this._c.nextElementSibling;
        var curr = back
            ? this._c.previousElementSibling 
            : this._c;
        if (!curr)
            return;
        this._undostack.push(new DeleteCommand(this, [curr], [next], back));
    },


    eraseSelection: function() {
        var delset = $(this._e).children("span.sl");
        if (delset.length == 0)
            return false;
        this._c = delset.last().next().get(0);
        // if we're on a space boundary and the next character
        // after the selection is also a space, hoover it up
        // as well
        if (delset.first().prev().length) {
            if (delset.first().prev().text().match(/^\s$/)) {
                if ($(this._c).text().match(/^\s$/)) {
                    $(this._c).addClass(".sl");
                    this._c = this._c.nextElementSibling;
                }
            }
        }
        var elems = delset.not(".endmarker").get();
        elems.reverse();
        var nexts = [];
        for (var i in elems)
            nexts.push(elems[i].nextElementSibling);

        this._undostack.push(new DeleteCommand(this, elems, nexts, false));
        this._undostack.breakCompression();
        this.positionCursorTo(this._c);
        return true;
    },

                      
    insertChar: function(event) {
        this.eraseSelection();        
        var curr = this._c ? this._c : this._endmarker;
        var char = $("<span></span>")
            .text(event.charCode == 32
                    ? "\u00a0"
                    : String.fromCharCode(event.charCode)).get(0);

        this._undostack.push(new InsertCommand(this, char, curr));
    },
    
    /*
     * Private Functions
     */

    _handleKeyEvent: function(event) {
        // BROWSER HACK - FIXME: Firefox only receives
        // repeat key events for keypress, but ALSO 
        // fires keydown for non-char keys
        if ($.browser.mozilla) {
            if (!event.ctrlKey && event.type == "keydown")
                return;
        }

        if (event.ctrlKey) {
            switch (event.which) {
                case 90: // Z-key, for undo/redo
                    event.shiftKey
                        ? this._undostack.redo()
                        : this._undostack.undo();
                    event.preventDefault();
                    return false;
                default:
            }
            return true;
        }

        switch (event.keyCode) {
            case KC_LEFT:
            case KC_RIGHT:
            case KC_UP:
            case KC_DOWN:
            case KC_HOME:
            case KC_END:
                this._keyNav(event);
                break;
            case KC_ESCAPE: // abandon changes
                this.finishEditing(this._inittext);
                break;
            case KC_RETURN: // accept changes
                this.finishEditing();
                break;
            case KC_DELETE: 
            case KC_BACKSPACE: // delete or backspace
                this.deleteChar(event.keyCode == KC_BACKSPACE);
                break;
            default:
                if (!event.charCode)
                    return false;
                this.insertChar(event);
        }
        return true;
    },

    _initialiseCursor: function(clickevent) {
        // find the first letter in the series (ignore spaces)
        this._c = $(this._e).find("span").filter(function(index) {
            return $(this).text() != " ";                            
        }).get(0);
        this.positionCursorTo(this._c);
        $("body").append(this._cursor);
        this.blinkCursor(true);
    },

    _keyNav: function(event) {
        this._logger("Nav -> " + event.type + ": " + event.keyCode); 

        // break command compressions so further deletes/inserts
        // are undone/redone discretely
        this._undostack.breakCompression();

        // either deselect all, or set the start of a selection
        if (event.shiftKey) {
            if (!this._selectstart) {
                this._selectstart = this._c; 
            }
        } else {
            this.deselectAll();
        }

        switch (event.keyCode) {
            case KC_LEFT:
                this.moveCursorLeft();
                break;
            case KC_RIGHT:
                this.moveCursorRight();
                break;
            case KC_HOME:
                this.moveCursorToStart();
                break;
            case KC_END:
                this.moveCursorToEnd();
                break;
            default:                
        }
        if (event.shiftKey) {
            this.updateSelection(this._selectstart, this._c);
        }
    },

    _logger: function(text) {
        var log = $("#logwin");
        if (!log.length) {
            log = $("<span></span>")
                .attr("id", "logwin")
                .css({
                    opacity: 0.5,
                    backgroundColor: "#000",
                    fontSize: "2em",
                    borderRadius: "4px",
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    float: "left",
                    color: "#FFF"
                });

            $("body").append(log);
        }
        log.text((new Date()).getTime() + ":   " + text);
    },             

});
