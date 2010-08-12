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
    var END = 35;
    var HOME = 36;


    // selection start & end index
    var m_selectstart = -1;
    var m_selectend = -1;

    // initial text of selected element
    var m_inittext = null;

    var m_blinktimer = -1;

    var m_proxycontainer = $("<span></span>")
        .attr("id", "proxy_container");

    var m_char = null;

    var m_cursor = $("<div></div>")
        .addClass("editcursor")
        .text("|");
    

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

    var positionCursorTo = function(elem) {
        // if there's no char elem, set to back of
        // the container box
        if (elem.length == 0) {
            m_cursor
                .css("top", (m_elem.offset().top + 3) + "px")
                .css("left", (m_elem.offset().left + m_elem.width() + 3) + "px");
            return;
        }

        m_cursor
            .css("top", elem.offset().top + "px")
            .css("left", elem.offset().left + "px");
    }

    var moveCursorLeft = function() {
        // check if we're at the end
        // or at the beginning...
        if (!m_char.length) {
            m_char = m_elem.find("span").last();            
        } else {
            var prev = m_char.prev();
            if (!prev.length) {
                // we're already at the start
                return false;
            }
            m_char = prev;
        }
        positionCursorTo(m_char);
        return true;
    }

    var moveCursorRight = function() {
        m_char = m_char.next();
        positionCursorTo(m_char);
    }

    var moveCursorToStart = function() {
        m_char = m_elem.find("span").first();
        positionCursorTo(m_char);
    }

    var moveCursorToEnd = function() {
        m_char = $();
        positionCursorTo(m_char);
    }

    var initialiseCursor = function(clickevent) {
        // find the first letter in the series (ignore spaces)
        m_char = m_elem.find("span").filter(function(index) {
            return $(this).text() != " ";                            
        }).first();
        positionCursorTo(m_char);
        $("body").append(m_cursor);
        blinkCursor(true);

    }

    var deleteChar = function() {
        if (eraseSelection())
            return;
        var next = m_char.next();
        m_char.remove();
        m_char = next;
        positionCursorTo(m_char);
    }

    var eraseSelection = function() {
        var sel = document.getSelection();
        if (sel.toString() == "")
            return false;

        // work out where our range starts and ends
        var range = sel.getRangeAt(0);
        var start = $(range.startContainer.parentElement);
        var end = $(range.endContainer.parentElement);

        // if we've selected it all, blow away everything
        if (!start.prev().length && !end.next().length) {
            m_char = null;
            range.deleteContents();
            alert("not done yet");
            positionCursorTo(m_elem, true);
            return true;            
        }
        m_char = start.prev();

        var s = range.startContainer.parentElement;
        var e = range.endContainer.parentElement;
        var atend = false;
        while (true) {
            atend = s == e;
            next = s.nextElementSibling;  
            $(s).remove();
            s = next;
            if (atend)
                break;
        }
        m_elem.find("span").each(function(i, elem) {
            var next = $(this).next();
            if (next.length == 0)
                return;
            if ($(this).text() == " " && next.text() == " ")
                next.remove();
        });
        positionCursorTo(m_char);
        return true;
    }

    var insertChar = function(charcode, unshift) {
        eraseSelection();
        if (!unshift)
            charcode += 32;
        var char = $("<span></span>")
            .text(String.fromCharCode(charcode));
        if (m_char.length) {
            char.insertBefore(m_char);
        } else {
            char.append(m_elem);
        }
        positionCursorTo(m_char);
    }

    var insertSpace = function() {
        var text = document.createTextNode("\u00a0");
        var char = $("<span></span>")
            .append($(text))
            .insertBefore(m_char);
        positionCursorTo(m_char);
    }

    var backspace = function() {
        if (moveCursorLeft())
            deleteChar();
    }

    var keyPressDetection = function(event) {
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
        } else if (event.which == HOME) {
            moveCursorToStart();
        } else if (event.which == END) {
            moveCursorToEnd();
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
    }

    var charClicked = function(event) {
        var offset = $(this).offset();            
        var mid = $(this).width() / 2;
        var atend = $(this).next().length == 0;

        // if we've clicked on the first char, position the
        // cursor, set the start marker
        if ($(this).prev().length == 0) {
            positionCursorTo($(this));
            return;    
        }

        // if we click on latter half of the last element
        if ($(this).next().length == 0 && event.pageX > (offset.left + mid)) {
            positionCursorTo($(this), true);
            return;
        }

        // otherwise, we're in the middle somewhere
        if (event.pageX > (offset.left + mid)) 
            m_char = $(this).next();
        else
            m_char = $(this);

        positionCursorTo(m_char);
    }

    var selectCharUnderClick = function(event) {
        // find the 'new' span element that would've
        // been under the mouse when clicked
        for (var i = 0; i < m_elem.find("span").length; i++) {
            var elem = m_elem.find("span").slice(i);
            var elemoffset = elem.offset();
            if (event.pageX < elemoffset.left)
                continue;
            if (event.pageX > elemoffset.left + elem.width())
                continue;
            if (event.pageY < elemoffset.top)
                continue;
            if (event.pageY > elemoffset.top + elem.height())
                continue;
            m_char = elem;
            if (event.pageX > (elemoffset.left + (elem.width() / 2)))
                m_char = elem.next();
            break;
        }
        positionCursorTo(m_char);
    }

    this.setElement = function(element, clickevent) {
        if (m_elem != null) {
            self.releaseElement();
        }
        m_elem = $(element);
        m_inittext = m_elem.text();        
        self.grabElement(clickevent);
    }

    this.element = function() {
        return m_elem;
    }

    this.grabElement = function(clickevent) {
        m_elem.addClass("selected");    
        m_elem.addClass("editing");
        
        // wrap a span round each char
        m_elem.html($.map($.trim(m_elem.text()), function(ch) {
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

        $(window).bind("keydown.editortype", keyPressDetection);
                
        // bind mouse up to detect selection
        $(window).bind("mouseup.checkselection", function(event) {
            var sel = window.getSelection();
            if (sel.toString() == "")
                return;

            // reject the selection if it's outside the bounds of our
            // current line
            var r = sel.getRangeAt(0);
            if (r.commonAncestorContainer != m_elem.get(0)) {
                return false;
            }
            return true;
        }); 

        $(window).bind("keyup.editortype", function(event) {
            if (m_blinktimer == -1)
                blinkCursor(true);  
        });

        m_elem.find("span").live("click.positioncursor", charClicked);
                
        initialiseCursor();
        selectCharUnderClick(clickevent);
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
