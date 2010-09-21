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


const LONGKEY = 500;
OCRJS.LineEditor = Base.extend({

    _e: null,          // the element we're operating on 
    _c: null,          // the current character in front of the cursor 
    _selectstart: null,   // selection start & end  
    _inittext: null,      // initial text of selected element 
    _keyevent: null,      // capture the last key event 
    _blinktimer: -1,      // timer for cursor flashing
    _dragpoint: null,     // the point dragging started 
    _undostack: new OCRJS.UndoStack(this), // undo stack object 
    _cursor: $("<div></div>") // cursor element
            .addClass("editcursor")
            .text("|"),
    _endmarker: $("<div></div>")  // anchor for the end of the line 
            .addClass("endmarker"),


    blinkCursor: function(blink) {
        var self = this;
        if (blink) {
            this._cursor.toggleClass("blink");
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
        this._inittext = $(elem).text();        

        this.setupEvents()

        // wrap a span round each char
        $(this._e).html($.map($.trim($(this._e).text()), function(ch) {
            return "<span>" + ch + "</span>";
        }).join("")).append(
            this._endmarker.height($(this._e).height())
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
        this._cursor.remove();

        this.teardownEvents();
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
            self._logger(event.type + ": " + event.which);
            //alert(typeof event.which);
        });

        $(window).bind("keypress.editortype", function(event) {
            if (self._handleKeyEvent(event)) {
                event.preventDefault();
                return false;
            }
            self._logger(event.type + ": " + event.keyCode);
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

    moveCursorLeft: function() {
        // check if we're at the end
        // or at the beginning...
        if (!this._c) {
            this._c = $(this._e).find("span").get(-1);            
        } else {
            var prev = this._c.previousElementSibling;
            if (!prev) {
                // we're already at the start
                return false;
            }
            this._c = prev;
        }
        this.positionCursorTo(this._c);
        return true;
    },

    moveCursorRight: function() {
        if (!this._c)
            return false;
        this._c = this._c.nextElementSibling;
        // check if we're at the end
        this.positionCursorTo(this._c);
        return true;
    },

    moveCursorToStart: function() {
        this._c = $(this._e).children().get(0);
        this.positionCursorTo(this._c);
    },                   

    moveCursorToEnd: function() {
        this._c = null;
        this.positionCursorTo(this._c);
    },

    positionCursorTo: function(elem) {
        var mintop = $(this._e).offset().top;
        var minleft = $(this._e).offset().left;
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
        if (!elem || elem.tagName == "DIV") {
            var top = this._endmarker.offset().top;
            // hack around Firefox float drop bug
            if ($.browser.mozilla) {
                if ($(this._e).children().length > 1) {
                    top = $(this._e).children().slice(-2).offset().top;
                } else {
                    top = ($(this._e).offset().top + $(this._e).height()) - this._endmarker.height();
                }
            }
            this._cursor
                .css("top", top + "px")
                .css("left", (this._endmarker.offset().left + this._endmarker.width()) + "px");
            return;
        }

        var top = Math.max(mintop, $(elem).offset().top);
        var left = Math.max(minleft, $(elem).offset().left);
        this._cursor.css("top", top + "px").css("left", left + "px");
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
        if (eraseSelection())
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
        m_undostack.push(new DeleteCommand([curr], [next], back));
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

        this._undostack.push(new DeleteCommand(elems, nexts, false));
        this._undostack.breakCompression();
        this.positionCursorTo(this._c);
        return true;
    },

                      
    /*
     * Private Functions
     */

    _handleKeyEvent: function(event) {
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
            case KC_RETURN: // accept changes
                this.finishEditing();
            case KC_DELETE:

            default:
                return false;
                

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

        // BROWSER HACK - FIXME: Firefox only receives
        // repeat key events for keypress, but ALSO 
        // fires keydown for non-char keys
        if ($.browser.mozilla) {
            if (event.type == "keydown")
                return;
        }

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
