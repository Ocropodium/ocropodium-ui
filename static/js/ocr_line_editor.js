// Editor for text on a single OCR transcript line


function OcrLineEditor(insertinto_id) {
    // the element we're operating on
    var m_elem = null;

    // useful key codes
    const KC_ESCAPE = 27;
    const KC_RETURN = 13;
    const KC_LEFT = 37;
    const KC_RIGHT = 39;
    const KC_DELETE = 46;
    const KC_BACKSPACE = 8;
    const KC_SHIFT = 16;
    const KC_CTRL = 17;
    const KC_ALT = 18;
    const KC_CAPSLOCK = 20;
    const KC_TAB = 9;
    const KC_END = 35;
    const KC_HOME = 36;

    const LONGKEY = 500;
    const SHORTKEY = 70;

    // selection start & end 
    var m_selectstart = null;

    // initial text of selected element
    var m_inittext = null;

    // capture the last key event
    var m_keyevent = null;

    var m_blinktimer = -1;

    // timer for sending scroll events for mozilla
    var m_navtimer = -1;

    var m_proxycontainer = $("<span></span>")
        .attr("id", "proxy_container");

    // the current character in front of the cursor
    var m_char = null;

    // the point dragging started
    var m_dragpoint = null;

    var m_cursor = $("<div></div>")
        .addClass("editcursor")
        .text("|");
    
    // anchor for the end of the line
    var m_endmarker = $("<div></div>")
            .addClass("endmarker");

    // alias 'this'
    var self = this;

    var blinkCursor = function(blink) {
        if (blink) {
            m_cursor.toggleClass("blink");
            m_blinktimer = setTimeout(function() {
                blinkCursor(true);        
            }, LONGKEY);
        } else {
            clearTimeout(m_blinktimer);
            m_blinktimer = -1;
        }
    }

    var positionCursorTo = function(elem) {
        var mintop = m_elem.offset().top;
        var minleft = m_elem.offset().left;
        // anchor to either the prev element or the parent
        if (elem.prev().length) {
            mintop = Math.max(mintop, elem.prev().offset().top);
            minleft = Math.max(minleft, elem.prev().offset().left);
        }
        // if there's no char elem, set to back of
        // the container box
        if (elem.length == 0 || elem.get(0).tagName == "DIV") {
            var top = m_endmarker.offset().top;
            // hack around Firefox float drop bug
            if ($.browser.mozilla) {
                if (m_elem.children().length > 1) {
                    top = m_elem.children().slice(-2).offset().top;
                } else {
                    top = (m_elem.offset().top + m_elem.height()) - m_endmarker.height();
                }
            }
            m_cursor
                .css("top", top + "px")
                .css("left", (m_endmarker.offset().left + m_endmarker.width()) + "px");
            return;
        }
        var top = Math.max(mintop, elem.offset().top);
        var left = Math.max(minleft, elem.offset().left);
        m_cursor
            .css("top", top + "px")
            .css("left", elem.offset().left + "px");
    }

    var clearSelection = function() {
        m_selectstart = null;
        var done = m_elem.children(".sl").length > 0;
        m_elem.children().removeClass("sl");
        return done;
    }

    var moveCursorLeft = function(repeat) {
        if (!m_keyevent.shiftKey)
            clearSelection();
        if (repeat && m_navtimer != -1) {
            m_navtimer = setTimeout(function() {
                if (m_navtimer != -1)
                    clearTimeout(m_navtimer);   
                m_navtimer = moveCursorLeft(repeat);
            }, SHORTKEY);
        }
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

    var keyNav = function(code) {
        if (!m_keyevent.shiftKey) {
            clearSelection();
        } else {
            if (m_selectstart == null)
                m_selectstart = $(m_char.get(0));
        }

        if (code == KC_RIGHT) {
            moveCursorRight(false);
            if($.browser.mozilla) {
                m_navtimer = setTimeout(function() {
                    moveCursorRight(true)
                }, LONGKEY);
            }
        } else if (code == KC_LEFT) {
            moveCursorLeft(false);
            if($.browser.mozilla) {
                m_navtimer = setTimeout(function() {
                    moveCursorLeft(true)
                }, LONGKEY);
            }
        } else if (code == KC_HOME)
            moveCursorToStart();
        else if (code == KC_END)
            moveCursorToEnd();
        if (m_keyevent.shiftKey)
            updateSelection(m_selectstart.get(0), m_char.get(0));
    }

    var updateSelection = function(s, e) {
        if (s == e) {
            m_elem.children().removeClass("sl");
            return;
        }
        var span = m_elem.get(0);
        var gotstart = false;
        for (var i = 0; i < span.childElementCount; i++) {         
            if (span.children[i] == s || span.children[i] == e) {
                gotstart = !gotstart;
            }
            $(span.children[i]).toggleClass("sl", gotstart);
        }
    }

    var moveCursorRight = function(repeat) {
        if (!m_char.length)
            return false;
        m_char = m_char.next();
        if (repeat && m_navtimer != -1) {
            m_navtimer = setTimeout(function() {
                if (m_navtimer != -1)
                    clearTimeout(m_navtimer);   
                m_navtimer = moveCursorRight(repeat);
            }, SHORTKEY);
        }
        // check if we're at the end
        positionCursorTo(m_char);
        return true;
    }

    var moveCursorToStart = function() {
        if (!m_keyevent.shiftKey)
            clearSelection();
        m_char = m_elem.find("span").first();
        positionCursorTo(m_char);
    }

    var moveCursorToEnd = function() {
        if (!m_keyevent.shiftKey)
            clearSelection();
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
        var next = m_char.first().next();
        m_char.first().not(".endmarker").remove();
        m_char = next;
        positionCursorTo(m_char);
    }

    var eraseSelection = function() {
        var delset = m_elem.children("span.sl");
        if (delset.length == 0)
            return false;
        m_char = delset.last().next();
        // if we're on a space boundary and the next character
        // after the selection is also a space, hoover it up
        // as well
        if (delset.first().prev().length) {
            if (delset.first().prev().text().match(/^\s$/)) {
                if (m_char.text().match(/^\s$/)) {
                    m_char.addClass(".sl");
                    m_char = m_char.next();
                }
            }
        }
        delset.not(".endmarker").remove();
        positionCursorTo(m_char);
        return true;
    }

    var insertChar = function() {
        var charcode = m_keyevent.which;        
        eraseSelection();
        var char = $("<span></span>")
            .text(m_keyevent.charCode == 32
                    ? "\u00a0"
                    : String.fromCharCode(m_keyevent.charCode));
        if (m_char.length) {
            char.insertBefore(m_char.first());
        } else {
            char.insertBefore(m_endmarker);
        }
        positionCursorTo(m_char);
    }
    
    var backspace = function(event) {
        if (eraseSelection())
            return;
        if (moveCursorLeft())
            deleteChar();
    }

    var keyPressDetection = function(event) {
        m_keyevent = event;
        if (event.ctrlKey || event.altKey)
            return;

        if (event.which == KC_ALT || event.which == KC_CTRL
            || event.which == KC_CAPSLOCK) {

        } else if (event.which == KC_TAB) {
            if (!event.shiftKey)             
                self.onEditNextElement();
            else
                self.onEditPrevElement();
            return false;
        } else if (event.which == KC_ESCAPE) {
            finishEditing(m_inittext);
        } else if (event.which == KC_RETURN) {
            finishEditing();
        } else if (event.which == KC_RIGHT) {
            keyNav(KC_RIGHT);
        } else if (event.which == KC_LEFT) {
            keyNav(KC_LEFT);
        } else if (event.which == KC_HOME) {
            keyNav(KC_HOME);
        } else if (event.which == KC_END) {
            keyNav(KC_END);
        } else if (event.which == KC_DELETE) {
            deleteChar();
        } else if (event.which == KC_BACKSPACE) {
            backspace();
        } else if (event.which == KC_SHIFT) {
        } else {
            //alert(event.which);
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

    var selectCurrentWord = function(event) {
        // this is TERRIBLE!  Whatever, too late, will
        // fix it in the cold light of day.
        clearSelection();
        if (m_char.length == 0)
            return;
        var startchar = m_char.first().get(0);
        while (startchar.previousElementSibling 
                && startchar.previousElementSibling.textContent.match(/^\w$/)) {
            startchar = startchar.previousElementSibling;
        }
        var endchar = m_char.first().get(0);        
        while (endchar && endchar != m_endmarker.get(0)
                && endchar.textContent.match(/^\w$/)) {
            endchar = endchar.nextElementSibling;
        }
        updateSelection(startchar, endchar);
    }

    var selectCharUnderClick = function(event) {
        if (!event)
            return;
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


    var isCapslock = function (e) {
        e = (e) ? e : window.event;

        var charCode = false;
        if (e.which) {
            charCode = e.which;
        } else if (e.keyCode) {
            charCode = e.keyCode;
        }
        var shifton = false;
        if (e.shiftKey) {
            shifton = e.shiftKey;
        } else if (e.modifiers) {
            shifton = !!(e.modifiers & 4);
        }
        if (charCode >= 97 && charCode <= 122 && shifton) {
            return true;
        }
        if (charCode >= 65 && charCode <= 90 && !shifton) {
            return true;
        }

        return false;
    }

    var valueInRange = function(value, min, max) {
        return (value <= max) && (value >= min);
    }

    var rectOverlap = function(A, B) {
        var xOverlap = valueInRange(A.x, B.x, B.x + B.width) ||
            valueInRange(B.x, A.x, A.x + A.width);
        var yOverlap = valueInRange(A.y, B.y, B.y + B.height) ||
            valueInRange(B.y, A.y, A.y + A.height);
        return xOverlap && yOverlap;
    }


    var expandSelectedChars = function(moveevent) {
        if (!m_dragpoint)
            return;
        // create a normalised rect from the current
        // point and the m_dragpoint
        //
        var x0 = Math.min(m_dragpoint.x, moveevent.pageX),
            x1 = Math.max(m_dragpoint.x, moveevent.pageX),
            y0 = Math.min(m_dragpoint.y, moveevent.pageY),
            y1 = Math.max(m_dragpoint.y, moveevent.pageY);
        var cbox = {x: x0, y: y1, width: x1 - x0, height: y1 - y0},
            span = m_elem.get(0),
            cr,
            box;
        for (var i = 0; i < span.childElementCount; i++) {
            cr = span.children[i].getClientRects()[0];
            box = {
                x: cr.left,
                y: cr.top,
                width: cr.right - cr.left, 
                height: cr.bottom - cr.top,
            }
            $(span.children[i]).toggleClass("sl", rectOverlap(cbox, box));
        }
    }


    var finishEditing = function(withtext) {
        var element = m_elem;
        releaseElement(withtext);
        self.onEditingFinished(element);
    }


    this.setElement = function(element, clickevent) {
        if (m_elem != null) {
            releaseElement();
        }
        m_elem = $(element);
        m_inittext = m_elem.text();        
        grabElement(clickevent);
        self.onEditingStarted(element);
    }

    this.element = function() {
        return m_elem;
    }

    var grabElement = function(clickevent) {
        m_elem.addClass("selected");    
        m_elem.addClass("editing");
        
        // wrap a span round each char
        m_elem.html($.map($.trim(m_elem.text()), function(ch) {
            return "<span>" + ch + "</span>";
        }).join("")).append(
            m_endmarker.height(m_elem.height())
        );

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
                finishEditing();
            }
        });

        $(window).bind("keydown.editortype", keyPressDetection);
        $(window).bind("keypress.editortype", function(event) {
            if (event.charCode == 0)
                return;
            m_keyevent = event;
            insertChar();        
        });
        window.getSelection().removeAllRanges();
                
        // bind mouse up to override selection
        $(window).bind("mouseup.checkselection", function(event) {
            $(window).unbind("mousemove.noselection");
            return false;
        });

        m_elem.bind("mousedown.noselection", function(event) {
            $(window).bind("mousemove.noselection", function(event) {
                window.getSelection().removeAllRanges();
            });
        });

        // handler to track mouse moves when selecting text
        m_elem.bind("mousedown.selecttext", function(event) {
            m_dragpoint = { x: event.pageX, y: event.pageY };
            m_elem.bind("mousemove.selecttext", function(event) {
                expandSelectedChars(event);                
            });
            $(window).bind("mouseup.selecttext", function(event) {
                m_elem.unbind("mousemove.selecttext");
                $(window).unbind("mouseup.selecttext");
                m_dragpoint = null;
            });            
        });

        m_elem.bind("dblclick.selectword", function(event) {
            window.getSelection().removeAllRanges();
            selectCurrentWord();
        });

        $(window).bind("keyup.editortype", function(event) {
            if (m_blinktimer == -1)
                blinkCursor(true);
            clearTimeout(m_navtimer);
            m_navtimer = -1;
        });

        m_elem.find("span").live("click.positioncursor", charClicked);
        m_elem.find("span").live("click.clearselect", clearSelection);

        initialiseCursor();
        selectCharUnderClick(clickevent);
    }


    var releaseElement = function(settext) {
        m_elem.children()
            .die("click.clearselect")
            .die("click.positioncursor");
        m_elem
            .html(settext ? settext : m_elem.text())
            .removeClass("selected")
            .removeClass("editing")
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
        m_elem.unbind("mousedown.noselection");

        m_elem = null;
        blinkCursor(false);
        m_cursor.remove();
    }
}

OcrLineEditor.prototype.onEditNextElement = function(event) {

}

OcrLineEditor.prototype.onEditPrevElement = function(event) {

}

OcrLineEditor.prototype.onEditingStarted = function(event) {

}

OcrLineEditor.prototype.onEditingFinished = function(event) {

}


