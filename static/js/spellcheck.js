// Spell checker widget.  Pops up a dialog allowing you to choose 
// a replacement word for any text in a given element


function SuggestionList() {

    this.parent = parent;


    var 
    self = this,
    m_focus = false,
    m_container = $("<div></div>")
        .attr("id", "sp_suggestionlist");

    const
    DOWN    = 40,
    UP      = 38,
    ESCAPE  = 27,
    ENTER   = 13;


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
            return false;
        if (event.keyCode == DOWN) {
            var sel = m_container.find(".selected").next();
            if (sel.length == 0) {
                sel = m_container.find(".sp_suggestion").first();
            }
            selectSuggestion(sel);
        } else if (event.keyCode == UP) {
            var sel = m_container.find(".selected").prev();
            if (sel.length == 0) {
                self.looseFocus();
            }
            selectSuggestion(sel);
        } else if (event.keyCode == ENTER) {
            var sel = m_container.find(".selected").first();
            self.suggestionChosen(sel.text());
        } else if (event.keyCode == ESCAPE) {
            self.looseFocus();
        }
        return false;
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



function Spellchecker(selector) {

    var 
    self = this,    
    m_data = null,
    m_selector = selector,
    m_suggestions = new SuggestionList(),
    m_lineedit = $("<input></input>")
            .attr("type", "text")
            .addClass("spell_line")
            .attr("id", "sp_lineedit");

    const
    DOWN    = 40,
    UP      = 38,
    ESCAPE  = 27,
    ENTER   = 13;

    
    /*
     *  Events...
     */

    // FIXME:  This shouldn't be a live event, but bound after
    // the UI is built.
    $("#sp_next, #sp_prev").live("click", function(event) {
        setNextSpellcheckWord($(this).attr("id") == "sp_prev");    
    });


    $(".suggestion").live("click", function(event) {
        var replace = $(this).text();
        $("#suggestion_list").parent().replaceWith(replace);
        closeSuggestionWindow();        
    });


    m_lineedit.focus(function(){
        // Select field contents
        this.select();
    });


    this.init = function() {
        buildUi();
    }

    var findNextSpellcheckWord = function(current, reverse) {
        traverser = reverse ? "prev" : "next";
        endpoint  = reverse ? "last" : "first"; 
        if (!current || !current.length)
            return $(m_selector).find(".badspell")[endpoint]();
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
        if (!next || !next.length)
            return $(m_selector)
                .find(".badspell")
                .not(current)[endpoint]();

        return next; 
    }


    var setNextSpellcheckWord = function(reverse) {
        var current = m_lineedit.data("current");
        var elem = findNextSpellcheckWord(current, reverse);
        if (current)
            current.removeClass("current");
        elem.addClass("current");
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


    var buildUi = function() {
        var container = $("<div></div>")
            .attr("id", "sp_container")
            .hide();
        var buttoncontainer = $("<div></div>")
            .attr("id", "sp_buttoncontainer");
        var textcontainer = $("<div></div>")
            .attr("id", "sp_textcontainer");
        var linecontainer = $("<div></div>")
            .attr("id", "sp_linecontainer");

        m_lineedit.unbind("keydown.le");
        m_lineedit.bind("keydown.le", function(event) {
            if (event.keyCode == UP || event.keyCode == DOWN) {
                $(this).blur();
                m_suggestions.takeFocus(event);
                return false;
            } else if (event.keyCode == ENTER) {
                var correctelem = $(this).data("current");
                var correcttext = $(this).val();
                setNextSpellcheckWord(event.shiftKey);
                if (!event.ctrlKey && correcttext && correctelem) {
                    if (correctelem.text() != correcttext)
                        correctelem.replaceWith(correcttext);
                }
                return false;
            }
        });


        textcontainer
            .append(linecontainer.append(m_lineedit));
        m_suggestions.init(textcontainer);

        m_suggestions.suggestionChosen = function(correcttext) {
            var correctelem = m_lineedit.data("current");
            setNextSpellcheckWord();
            if (correcttext && correctelem) {
                if (correctelem.text() != correcttext)
                    correctelem.replaceWith(correcttext);
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
            sp_all: "Something",
            sp_adddict: "Add to Dict",
        };
        $.each(buttons, function(key, val) {
            buttoncontainer.append(
                $("<input></input>")
                    .attr("type", "button")
                    .attr("id", key)
                    .val(val)
            );
        });

        container
            .append(buttoncontainer)
            .append(textcontainer);

        $(document).find("#sp_container").remove();
        container.insertAfter($("#scroll_container")).show(200);
        //container.appendTo($("body")).dialog({model: true});
    }


    this.spellCheck = function() {
        var text = $.map($(m_selector), function(c) {
            return $(c).text();
        }).join("\n");

        $.ajax({
            url: "/batch/spellcheck",
            type: "POST",
            data: {text: text},
            dataType: "json",
            error: function(xhr, err) {
                alert("Spellcheck failed.  Unable to reach server: " + e);
            },
            success: function(data) {
                m_data = data;
                highlightWords();
            }
        });
    }


    var highlightWords = function() {
        $(m_selector).each(function(i, elem) {
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
