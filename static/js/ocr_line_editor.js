// Editor for text on a single OCR transcript line


function OcrLineEditor(insertinto_id) {
    // the element we're operating on
    var m_elem = null;

    // useful key codes
    var ESCAPE = 27;
    var RETURN = 13;
    var LEFT = 37;
    var RIGHT = 39;
    var DELETE = 46;
    var BACKSPACE = 8;
    var SHIFT = 16;
    var CTRL = 17;
    var ALT = 18;
    var CAPSLOCK = 20;
    var TAB = 9;


    // selection start & end index
    var m_selectstart = -1;
    var m_selectend = -1;

    // initial text of selected element
    var m_inittext = null;

    var m_blinktimer = -1;

    var m_proxycontainer = $("<span></span>")
        .attr("id", "proxy_container");

    var m_currchar = null;

    var m_cursor = $("<div></div>")
        .addClass("editcursor")
        .text("|");
    
    // we're at the end of the text line
    var m_endstop = false;

    // we're at the start of the text line
    var m_startstop = true;



    // alias 'this'
    var self = this;

    var blinkCursor = function(blink) {
        if (blink) {
            m_cursor.toggleClass("blink");
            m_blinktimer = setTimeout(function() {
                blinkCursor(true);        
            }, 500);
        } else {
            clearTimeout(m_blinktimer);
            m_blinktimer = -1;
        }
    }


    var positionCursorTo = function(elem, atend) {
        var w = elem.width();
        m_cursor
            .css("top", elem.offset().top + "px")
            .css("left", (elem.offset().left + (atend ? w : 0)) + "px");
    }

    var moveCursorLeft = function() {
        if (m_startstop)
            return;

        var prev = m_currchar.prev();
        if (prev.length == 1) {            
            if (!m_endstop)
                m_currchar = prev;
            m_endstop = false;
        }
        positionCursorTo(m_currchar);
        m_startstop = prev.length == 0;    
    }

    var moveCursorRight = function() {
        if (m_endstop)
            return;

        var next = m_currchar.next();
        if (next.length == 1) {
            m_currchar = next;
            m_startstop = false;
        }
        positionCursorTo(m_currchar, next.length == 0);
        m_endstop = next.length == 0;    
    }

    var initialiseCursor = function() {
        // find the first letter in the series (ignore spaces)
        m_currchar = m_elem.find("span").filter(function(index) {
            return $(this).text() != " ";                            
        }).first();
        positionCursorTo(m_currchar, true);
        $("body").append(m_cursor);
        blinkCursor(true);    
    }

    var deleteChar = function() {
        if (m_endstop)
            return;
        var next = m_currchar.next();
        m_currchar.remove();
        m_currchar = next;
        positionCursorTo(m_currchar);
    }

    var insertChar = function(charcode, unshift) {
        if (!unshift)
            charcode += 32;
        var char = $("<span></span>")
            .text(String.fromCharCode(charcode))
            .insertBefore(m_currchar);
        positionCursorTo(m_currchar);
    }

    var insertSpace = function() {
        var text = document.createTextNode("\u00a0");
        var char = $("<span></span>")
            .append($(text))
            .insertBefore(m_currchar);
        positionCursorTo(m_currchar);
    }

    var backspace = function() {
        if (m_startstop) {
            alert("stop");
            return;
        }
        moveCursorLeft();
        deleteChar();
    }

    this.setElement = function(element) {
        if (m_elem != null) {
            self.releaseElement();
        }
        m_elem = $(element);
        m_inittext = m_elem.text();        
        self.grabElement();
    }

    this.element = function() {
        return m_elem;
    }

    this.grabElement = function() {
        m_elem.addClass("selected");    
        m_elem.addClass("editing");
        
        // wrap a span round each char
        m_elem.html($.map(m_elem.text(), function(ch) {
            return "<span>" + ch + "</span>";
        }).join(""));
        
        // set up a click handler for the window
        // if we click outside the current element, 
        // close the editor and unbind the click
        $(window).bind("click.editorblur", function(event) {
            var left = m_elem.offset().left;
            var top = m_elem.offset().top;
            var width = m_elem.outerWidth();
            var height = m_elem.outerHeight();

            if (!(event.pageX >= left 
                    && event.pageX <= (left + m_elem.width())
                    && event.pageY >= top
                    && event.pageY <= (top + m_elem.height()))) {
                self.releaseElement();
            }
        });

        $(window).bind("keydown.editortype", function(event) {
            if (event.ctrlKey || event.altKey)
                return;

            if (event.which == ALT || event.which == CTRL
                || event.which == TAB || event.which == CAPSLOCK) {

            } else if (event.which == ESCAPE) {
                self.releaseElement(m_inittext);
            } else if (event.which == RETURN) {
                self.releaseElement();
            } else if (event.which == RIGHT) {
                moveCursorRight();
            } else if (event.which == LEFT) {
                moveCursorLeft();
            } else if (event.which == DELETE) {
                deleteChar();
            } else if (event.which == BACKSPACE) {
                backspace();;
            } else if (event.which == SHIFT) {
                
            } else if ((event.which >= 48 
                    && event.which <= 90)
                    || (event.which >= 186
                        && event.which <= 222)) {
                insertChar(event.which, event.shiftKey);
            } else if (event.which == 32) { 
                insertSpace();            
            } else {
                alert(event.which);
            }
            blinkCursor(false);    
        });

        $(window).bind("keyup.editortype", function(event) {
            if (m_blinktimer == -1)
                blinkCursor(true);  
        });

        m_elem.find("span").live("click.positioncursor", function(event) {
            var offset = $(this).offset();
            var mid = $(this).width() / 2;
            if (event.pageX > (offset + mid)) {
                if ($(this).next().length == 0) {
                    m_currchar = null;
                    positionCursorTo($(this), true);
                    m_endstop = true;
                } else {
                    m_currchar = $(this).next();
                    positionCursorTo($(this).next());                }
                    m_endstop = false;                                        
            } else {
                m_currchar = $(this);
                positionCursorTo(m_currchar);
            }
            if ($(this).prev().length == 0) {
                m_startstop = true;
            }                        
        });
        initialiseCursor();
    }


    this.releaseElement = function(settext) {
        m_elem.find("span").die("click.positioncursor");
        m_elem.html(settext ? settext : m_elem.text());                                
        m_elem.removeClass("selected");
        m_elem.removeClass("editing");
        m_elem.unbind("mouseup.textsel");

        $(window).unbind("click.editorblur");
        $(window).unbind("keydown.editortype");
        m_elem = null;
        m_cursor.remove();
        blinkCursor(false);
    }
}
