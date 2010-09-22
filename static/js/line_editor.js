// Make a span editable.  Second attempt


if (OCRJS === undefined) {
    var OCRJS = {};
}


// Jquery, disallow selection
jQuery.fn.extend({ 
    allowSelection : function(allow) { 
        this.each(function() { 
            this.onselectstart = function() { return allow; }; 
            this.unselectable = allow ? "" : "on"; 
            jQuery(this).css('-moz-user-select', allow ?  null : 'none'); 
        });
        return this; 
    } 
});




/*
 * Undo Commands for insert/delete
 *
 */

var InsertCommand = OCRJS.UndoCommand.extend({
    constructor: function(editor, char, curr) {
        this.base("typing");
        this.editor = editor;
        this.curr = curr;
        this.char = char;
        var self = this;
        this.redo = function() {
            $(self.char).insertAfter(self.curr.previousElementSibling);
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

    _elem: null,          // the element we're operating on 
    _char: null,          // the current character in front of the cursor
    _top: null,         // reference to initial top of elem
    _left: null,        // reference to initial left of elem 
    _selectstart: null,   // selection start & end  
    _inittext: null,      // initial text of selected element 
    _keyevent: null,      // capture the last key event 
    _blinktimer: -1,      // timer for cursor flashing
    _dragpoint: null,     // the point dragging started
    _editing: false,      // we're currently doing something 
    _undostack: new OCRJS.UndoStack(this), // undo stack object
    _notemptyre: new RegExp("\S"), 
    _cursor: $("<div></div>") // cursor element
            .addClass("editcursor")
            .text("").get(0),
    _endmarker: $("<div></div>")  // anchor for the end of the line 
            .addClass("endmarker").get(0),

    constructor: function(log) {
        this._log = log;
    },    

    /*
     * Setup and teardown functions
     *
     */

    edit: function(elem, event, log) {
        if (this._editing)
            this.finishEditing();                
        if (!elem)
            throw "Attempt to edit null element";
        this._e = elem;
        this._top = $(elem).offset().top;
        this._left = $(elem).offset().left;
        this._inittext = $(elem).text();        
        this._editing = true;

        this.setupEvents()

        // wrap a span round each char
        $(this._e).html($.map($.trim($(this._e).text()), function(ch) {
            return "<span>" + ch + "</span>";
        }).join("")).append(
            $(this._endmarker).height($(this._e).height())
        );

        $(elem)
            .addClass("selected")
            .addClass("editing")
            .allowSelection(false);

        this._initialiseCursor();
        if (event && event.type.match(/click/))
            this._selectCharUnderPoint(event);
        this._logger("Current char: " + $(this._c).text() + " Full: " + $(this._e).text());
        this.onEditingStarted(elem);
    },


    finishEditing: function(withtext) {
        var elem = this._e;
        $(this._e)
            .removeClass("selected")
            .removeClass("editing")
            .allowSelection(true)        
            .html(withtext ? withtext : $(this._e).text());
        this._selectstart = null;        
        $(this._cursor).detach();
        this._undostack.clear();
        if (this._blinktimer != -1) {
            clearTimeout(this._blinktimer);
            this._blinkcursor = -1;
        }
        this.teardownEvents();
        this._editing = false;
        this.onEditingFinished(elem);
    },


    setCurrentChar: function(charelem) {
        if (!$.inArray(this._e.children, charelem))
            throw "Char element is not a childen of line";
        if (!charelem)
            throw "Attempt to set null element as current char";
        this._c = charelem;
        this._mungeSpaces();
        this.positionCursorTo(this._c);
        this._logger("Current char: " + $(this._c).text() + " Full: " + $(this._e).text());
        //this._logger("Current char: " + $(this._c).text());
    },


    element: function() {
        return this._e;
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
                self.blinkCursor(false);    
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

        $(window).bind("keyup.editortype", function(event) {
            if (self._blinktimer == -1) {                
                self._blinktimer = setTimeout(function() {
                    self.blinkCursor(true);
                }, 2 * LONGKEY);
            }
        });

        // Mouse events
        $(this._e).find("span").live("click.positioncursor", function(event) {
            self._charClicked(event);
        });
        $(this._e).find("span").live("click.clearselect", function(event) {
            self.deselectAll();
        });
        $(this._e).bind("dblclick.selectword", function(event) {
            self._selectCurrentWord(event);
        });
        // handler to track mouse moves when selecting text
        $(this._e).bind("mousedown.selecttext", function(event) {
            self.deselectAll();
            self._dragpoint = { x: event.pageX, y: event.pageY };
            $(self._e).bind("mousemove.selecttext", function(event) {
                //self._expandSelectedChars(event);
                self._selectCharUnderPoint(event);
            });
            $(window).bind("mouseup.selecttext", function(event) {
                $(self._e).unbind("mousemove.selecttext");
                $(window).unbind("mouseup.selecttext");
                self._dragpoint = null;
            });            
        });        
    },


    teardownEvents: function() {
        $(this._e).children()
            .die("click.clearselect")
            .die("click.positioncursor");
        $(this._e)
            .unbind("dblclick.selectword")
            .unbind("mousedown.noselection")
            .unbind("mousemove.selecttext");
        $(window)
            .unbind("click.editorblur")
            .unbind("keydown.editortype")
            .unbind("keypress.editortype")
            .unbind("keyup.editortype")
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

    // determine if the line is wrapping.  Assumes
    // there are a least 2 chars (+ the endmarker)             
    isWrapping: function() {
        if (this._e.children < 3)
            return false;
        var first = this._e.children[0];
        var last = this._endmarker.previousElementSibling;
        return $(first).offset().top != $(last).offset().top;
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
        this._logger($(this._e).text());
        var char = $(this._e).children().first().get(0);
        if (!char)
            throw "First child of elem is null: " + this._e.firstChild + "  (" + this._e + ")";        
        this.setCurrentChar(char);
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
        if (elem && elem.previousElementSibling 
                    && $.trim($(elem.previousElementSibling).text())) {
            var prev = $(elem).prevAll().filter(function(i) {
                return $.trim($(this).text());
            }).first();
            if (prev.length) {
                mintop = Math.max(mintop, prev.offset().top);
                minleft = Math.max(minleft, prev.offset().left
                       + prev.width());
            }
        }

        var top = Math.max(mintop, $(elem).offset().top);
        if ($.browser.mozilla && !$(elem).text().match(/\w+/)) {
            var traverser = elem.previousElementSibling
                ? "prevAll"
                : "nextAll";
            var neartext = $(elem)[traverser]().filter(function(index) {
                return $(this).text().match(/\w+/);                            
            }).first();
            if (neartext.length) {
                top = neartext.offset().top;
            }
        }

        var left = Math.max(minleft, $(elem).offset().left);
        $(this._cursor).css("top", top + "px").css("left", left + "px");
    },


    blinkCursor: function(blink) {
        var self = this;
        if (blink) {
            $(self._cursor).toggleClass("blinkoff");
            self._blinktimer = setTimeout(function() {
                self.blinkCursor(true);        
            }, LONGKEY);
        } else {
            $(self._cursor).removeClass("blinkoff");
            clearTimeout(self._blinktimer);
            self._blinktimer = -1;
        }
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
     * Overridable events
     *
     */

    onEditNextElement: function(event) {

    },

    onEditPrevElement: function(event) {

    },

    onEditingStarted: function(event) {

    },

    onEditingFinished: function(event) {

    },



    /*
     * Private Functions
     */

    // handle key event - return true IF the event
    // IS handled                       
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
                    return true;
                default:
            }
            return false;
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
            case KC_TAB: // finish and go to next
                this.finishEditing();
                event.shiftKey 
                    ? this.onEditPrevElement()
                    : this.onEditNextElement();
                break;
            default:
                if (!event.charCode)
                    return false;
                this.insertChar(event);
                event.preventDefault();
        }
        return true;
    },


    _initialiseCursor: function(clickevent) {
        // find the first letter in the series (ignore spaces)        
        this._c = $(this._e).find("span").filter(function(index) {
            return $(this).text() != " ";                            
        }).get(0);
        $(this._cursor).css("height", $(this._c).height());
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


    _charClicked: function(event) {
        this._logger("Char clicked: " + $(event.target).text());
        var elem = event.target;
        var offset = $(elem).offset();            
        var mid = $(elem).width() / 2;
        var atend = $(elem).next().length == 0;

        // if we've clicked on the first char, position the
        // cursor, set the start marker
        if (!elem.previousElementSibling) {
            this.setCurrentChar(elem);
            return;    
        }

        // if we click on latter half of the last element
        if ($(elem).next("span").length == 0 && event.pageX > (offset.left + mid)) {
            this.setCurrentChar(this._endmarker);
            return;
        }

        // otherwise, we're in the middle somewhere
        if (event.pageX >= (offset.left + mid)) 
            elem = elem.nextElementSibling;
        this.setCurrentChar(elem);
    },


    // ensure that is the last char in the line is a space
    // that it's a non-breaking one.  Otherwise ensure that
    // all spaces are breaking entities.                 
    _mungeSpaces: function(event) {
        var self = this;
        if (this._endmarker.previousElementSibling) {
            var pes = this._endmarker.previousElementSibling;
            if ($(pes).text() == " ") {
                $(pes).text("\u00a0");
            }
        }
        $(this._endmarker).prevAll().filter(function(i) {
            if ($(this).text() == "\u00a0") {
                if ($(this).next().text().match(/\S/)) {
                    return true;                    
                }
            }
        }).each(function(i, elem) {
            $(elem).text(" ");    
        });
    },                  


    _selectCurrentWord: function(event) {
        // this is TERRIBLE!  Whatever, too late, will
        // fix it in the cold light of day.
        if (!event.shiftDown)
            this.deselectAll();
        var startchar = this._c;
        while (startchar.previousElementSibling 
                && startchar.previousElementSibling.textContent.match(/^\w$/)) {
            startchar = startchar.previousElementSibling;
        }
        var endchar = this._c;        
        while (endchar && endchar != this._endmarker
                && endchar.textContent.match(/^\w$/)) {
            endchar = endchar.nextElementSibling;
        }
        this.updateSelection(startchar, endchar);
    },


    _selectCharUnderPoint: function(event) {
        if (!event)
            return;
        // find the 'new' span element that would've
        // been under the mouse when clicked
        for (var i = 0; i < $(this._e).children("span").length; i++) {
            var elem = $(this._e.children[i]);
            var elemoffset = elem.offset();
            if (event.pageX < elemoffset.left)
                continue;
            if (event.pageX > elemoffset.left + elem.width())
                continue;
            if (event.pageY < elemoffset.top)
                continue;
            if (event.pageY > elemoffset.top + elem.height())
                continue;
            this._c = elem.get(0);
            if (event.pageX > (elemoffset.left + (elem.width() / 2)))
                this._c = elem.next().get(0);
            break;
        }
        if (!this._selectstart) {
            this._selectstart = this._c;
        } else {
            this.updateSelection(this._selectstart, this._c);
        }
        this.positionCursorTo(this._c);
    },                          


    _logger: function(text) {
        if (!this._log)
            return;            
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
