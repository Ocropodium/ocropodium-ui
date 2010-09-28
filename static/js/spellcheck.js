// Spell checker widget.  Pops up a dialog allowing you to choose 
// a replacement word for any text in a given element


function SuggestionList() {

    var 
    self = this,
    m_focus = false,
    m_container = $("<div></div>")
        .attr("id", "sp_suggestionlist");

    // events
    $(".sp_suggestion").live("click", function(event) {
        selectSuggestion($(this));
    });

    $(".sp_suggestion").live("dblclick", function(event) {
        self.suggestionChosen($(this).text());
    });


    this.init = function(parent) {
        m_container.appendTo($(parent));
    }

    this.loadSuggestions = function(suggestions) {
        m_container.html("");
        if (suggestions) {
            var tsugg = $("<div></div>")
                .addClass("sp_suggestion");
            $.each(suggestions, function(i, s) {
                m_container.append(
                    tsugg.clone().text(s)
                );
            });
        }
    }

    var selectSuggestion = function(sel) {
        m_container.find(".selected").removeClass("selected");
        sel.addClass("selected");
        if (sel.length) {
            if(sel.get(0))
                sel.get(0).scrollIntoView(false);
            self.suggestionSelected(sel.text());
        }
    }


    this.clearSelection = function() {
        m_container.find(".selected").removeClass("selected");
    }

    this.clear = function() {
        m_container.html("");
    }
    
    this.keyEvent = function(event) {
        if (event.type != "keydown")
        if (event.keyCode == KC_DOWN) {
            var sel = m_container.find(".selected").next();
            if (sel.length == 0) {
                sel = m_container.find(".sp_suggestion").first();
            }
            selectSuggestion(sel);
        } else if (event.keyCode == KC_UP) {
            var sel = m_container.find(".selected").prev();
            if (sel.length == 0) {
                self.looseFocus();
            }
            selectSuggestion(sel);
        } else if (event.keyCode == KC_ENTER) {
            var sel = m_container.find(".selected").first();
            self.suggestionChosen(sel.text());
        } else if (event.keyCode == KC_ESCAPE) {
            self.looseFocus();
        }
        event.preventDefault();
    }


    this.takeFocus = function(event) {
        m_focus = true;
        m_container.addClass("focus");
        self.keyEvent(event);
        $(window).unbind("keydown.sl keyup.sl keypress.sl");
        $(window).bind("keydown.sl keyup.sl keypress.sl", function(event) {
            self.keyEvent(event);
        });
    }
    

    this.looseFocus = function() {
        m_focus = false;
        m_container.find(".selected").removeClass("selected");         
        m_container.removeClass("focus");
        $(window).unbind("keydown.sl keyup.sl keypress.sl");
        self.focusLost();
    }

    this.hasFocus = function() {
        return m_focus;
    }

    this.currentSelection = function() {
        return m_container.find(".selected").text();
    }

    this.suggestionChosen = function(word) {
        // typically overridden...
        self.looseFocus();
    }

    this.focusLost = function(event) {

    }

    this.suggestionSelected = function(word) {

    }
}



function Spellchecker(parent, selector) {

    var 
    self = this,    
    m_wordindex = 0,
    m_data = {},
    m_parent = parent,
    m_suggestions = new OCRJS.SuggestionList(),
    m_lineedit = $("<input></input>")
            .attr("type", "text")
            .addClass("spell_line")
            .attr("id", "sp_lineedit"),
    m_container = $("<div></div>")
        .attr("id", "sp_container");

    
    /*
     *  Events...
     */

    // FIXME:  This shouldn't be a live event, but bound after
    // the UI is built.
    $("#sp_next, #sp_prev").live("click", function(event) {
        setNextSpellcheckWord($(this).attr("id") == "sp_prev");    
    });


    m_lineedit.focus(function(){
        // Select field contents
        this.select();
    });


    this.init = function() {
        m_container.html("");
        return buildUi();
    }

    this.widgetHeight = function() {
        return m_container.outerHeight(true);
    }

    var findNextSpellcheckWord = function(current, reverse) {
        var badcount = $(".badspell").length;
        traverser = reverse ? "prev" : "next";
        endpoint  = reverse ? "last" : "first"; 
        if (!current || !current.length)  {
            return $(".badspell")[endpoint]();
        }
        var next = current[traverser]();
        if (!next.length) {
            var nextline = current.parent()[traverser]();
            while (true) {
                if (!nextline.length)
                    break;
                next = nextline.find(".badspell")[endpoint]();
                if (next.length) 
                    break;
                nextline = nextline[traverser]();        
            }
        }
        if (!next || !next.length) {
            return $(".badspell")
                .not(current)[endpoint]();
        }
        if (reverse)
            m_wordindex = Math.max(0, m_wordindex - 1);
        else
            m_wordindex = Math.min(badcount, m_wordindex + 1);
        return next; 
    }

    var setNextSpellcheckWord = function(reverse) {
        var current = m_lineedit.data("current");
        var elem = findNextSpellcheckWord(current, reverse);
        if (current)
            current.removeClass("current");
        elem.addClass("current");
        if (elem.get(0))
            elem.get(0).scrollIntoView(false);
        
        m_lineedit.data("current", elem);
        
        m_suggestions.looseFocus();
        var word = m_lineedit.val();
        if (m_data[word]) {
            var suggestions = m_data[word].suggestions;
            m_suggestions.loadSuggestions(suggestions);
        } else {
            m_suggestions.clear();
        }
        //highlight the parent line
        elem.parent().click();
    }


    var buildUi = function(parent) {
        var buttoncontainer = $("<div></div>")
            .attr("id", "sp_buttoncontainer");
        var textcontainer = $("<div></div>")
            .attr("id", "sp_textcontainer");
        var linecontainer = $("<div></div>")
            .attr("id", "sp_linecontainer");

        textcontainer
            .append(linecontainer.append(m_lineedit));
        m_suggestions.init(textcontainer);

        m_suggestions.suggestionChosen = function(correcttext) {
            var correctelem = m_lineedit.data("current");
            setNextSpellcheckWord();
            if (correcttext && correctelem) {
                if (correctelem.text() != correcttext) {
                    correctelem.replaceWith(correcttext);
                    self.onWordCorrection();
                }
            }
            if (!m_lineedit.data("current").length) {
                m_lineedit
                    .val("")
                    .attr("disabled", true);
                m_suggestions.clear();
                container.remove();
            }
            m.suggestions.looseFocus();
        }


        m_suggestions.suggestionSelected = function(word) {
            m_lineedit.val(word).focus().select();
        }


        m_suggestions.focusLost = function() {
            m_lineedit
                .val(m_lineedit.data("current").text())
                .focus().select();
        }
        
        var buttons = {
            sp_next: "Next",
            sp_prev: "Prev",
            sp_ignore: "Ignore Word",
            sp_ignoreall: "Ignore All",
            sp_adddict: "Add to Dictionary",
        };
        $.each(buttons, function(key, val) {
            buttoncontainer.append(
                $("<input></input>")
                    .attr("type", "button")
                    .attr("id", key)
                    .val(val)
            );
        });

        m_container
            .append(buttoncontainer)
            .append(textcontainer);

        return m_container;
    }

    this.takeFocus = function() {
        m_lineedit.unbind("keydown.le");
        m_lineedit.bind("keydown.le", function(event) {
            if (event.keyCode == KC_UP || event.keyCode == KC_DOWN) {
                $(this).blur();
                m_suggestions.navigateList(event);
                event.preventDefault();
            } else if (event.keyCode == KC_TAB) {
                setNextSpellcheckWord(event.shiftKey);
                event.preventDefault();
            } else if (event.keyCode == KC_RETURN) {
                var correctelem = $(this).data("current");
                var correcttext = $(this).val();
                setNextSpellcheckWord(event.shiftKey);
                if (!event.ctrlKey && correcttext && correctelem) {
                    if (correctelem.text() != correcttext) {
                        correctelem.replaceWith(correcttext);
                        self.onWordCorrection();
                    }
                }
                event.preventDefault();
            }
        });
    }


    this.looseFocus = function() {
        m_lineedit.unbind("keydown.le");
    }


    this.spellCheck = function(lines) {
        var text = $.map(lines, function(c) {
            return $(c).text();
        }).join("\n");
        json = JSON.stringify(text);
        $.ajax({
            url: "/batch/spellcheck",
            type: "POST",
            data: {data: json},
            dataType: "json",
            error: function(xhr, err) {
                alert("Spellcheck failed.  Unable to reach server: " + err);
            },
            success: function(data) {
                if (data == null)
                    return;
                $.each(data, function(k, v) {
                    m_data[k] = v;
                })
                highlightWords(lines);
            }
        });
    }


    var highlightWords = function(lines) {
        lines.each(function(i, elem) {
            var html = $.map($(elem).html().split(/\b/), function(word) {
                if (m_data[word]) {
                    return "<span class='badspell'>" + word + "</span>";
                } else {
                    return word;
                }        
            }).join("");
            $(elem).html(html);
        });
        setNextSpellcheckWord();
    }
}


// events
Spellchecker.prototype.onWordCorrection = function() {
    
}
