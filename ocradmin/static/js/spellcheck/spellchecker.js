// Spellcheck widget


var ReplaceCommand = OCRJS.UndoCommand.extend({
    constructor: function(checker, cidx, elems, back, newelem, oldelem) {
        this.newelem = newelem;
        this.oldelem = oldelem;
        this.undo = function() {
            elems.splice(cidx, 0, oldelem);
            $(newelem).replaceWith(oldelem);
            checker.setCurrentElement(cidx);
        };
        this.redo = function() {
            elems.splice(cidx, 1);
            $(oldelem).replaceWith(newelem);
            checker.setCurrentElement(back ? cidx - 1 : cidx);
        };    
    },
});



OCRJS.Spellchecker = OCRJS.OcrBase.extend({

    constructor: function(parent, options) {
        this.base(options);
        this._listeners = {
            onWordCorrection: [],
            onWordHighlight: [],
        };        
        this.parent = parent;
        this._wordindex = 0;
        this._data = {};    // spellcheck data
        this._elements = [];   // highlighted element refs
        this._celement = -1;
        this._suggestions = new OCRJS.SuggestionList();
        this._undostack = new OCRJS.UndoStack();
        this._lineedit = $("<input></input>")
                .attr("type", "text")
                .addClass("spell_line")
                .attr("id", "sp_lineedit");
        this._container = $("<div></div>")
            .attr("id", "sp_container")
            .hide();
    },


    init: function(parent) {
        this.buildUi();
        return this._container;
    },          


    _setupEvents: function() {
        var self = this;                     
        
        $("#sp_next, #sp_prev", this._container).bind("click", function(event) {
            self.setNextSpellcheckWord($(this).attr("id") == "sp_prev");    
        });

        this._lineedit.bind("focus", function(event){
            // select field contents
            this.select();
        });

        // handle certain key events in the replace word text edit
        this._lineedit.bind("keydown.navsuggestion", function(event) {
            if (event.ctrlKey && event.keyCode == 90) { // Z-key
                if (!event.shiftKey)
                    self._undostack.undo();
                else
                    self._undostack.redo();
            } else if (event.keyCode == KC_UP || event.keyCode == KC_DOWN) {
                // up and down arrows for navigating suggestions
                $(this).blur();
                self._suggestions.navigateList(event);
            } else if (event.keyCode == KC_TAB) {
                // go to next misspelled word
                self.setNextSpellcheckWord(event.shiftKey);
            } else if (event.keyCode == KC_RETURN) {
                if (!event.ctrlKey) {
                    self.doReplacement(event.shiftKey);
                } else {
                    self.setNextSpellcheckWord(event.shiftKey);
                }
            } else {
                return true;
            }
            event.preventDefault();
        });

        this._suggestions.suggestionChosen = function(correcttext) {
            // do replacing of word here...
            this._suggestions.looseFocus();
        }

        // replace the current lineedit word with 
        // that selected
        this._suggestions.suggestionSelected = function(word) {
            self._lineedit.val(word).focus().select();
        }

        // focus back on the lineedit with the original text
        this._suggestions.focusLost = function() {
            self._lineedit
                .val($(self._elements[self._celement]).text())
                .focus().select();
        }
    },

    _teardownEvents: function() {
        $("#sp_next, #sp_prev", this._container).unbind("click");
        this._lineedit.unbind("keydown.navsuggestion");
        this._lineedit.unbind("focus");
    },                 

    show: function() {
        this._container.show();
        this._setupEvents();
    },

    hide: function() {
        this._container.hide();
        this.reset();
        this._teardownEvents();
    },

    reset: function() {
        this._elements = [];
        this._celement = -1;
        this._undostack.clear();
    },          
                     
    buildUi: function(parent) {
        var buttoncontainer = $("<div></div>")
            .attr("id", "sp_buttoncontainer");
        var textcontainer = $("<div></div>")
            .attr("id", "sp_textcontainer");
        var linecontainer = $("<div></div>")
            .attr("id", "sp_linecontainer");

        textcontainer
            .append(linecontainer.append(this._lineedit));
        this._suggestions.init(textcontainer);

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

        this._container
            .append(buttoncontainer)
            .append(textcontainer);
    },


    widgetHeight: function() {                              
        return this._container.is(":visible")
            ? this._container.outerHeight(true)
            : 0;
    },

    spellcheck: function(lines) {
        var self = this;
        var text = $.map(lines, function(c) {
            return $(c).text();
        }).join("\n");
        $.ajax({
            url: "/batch/spellcheck",
            type: "POST",
            data: { data: JSON.stringify(text) },
            dataType: "json",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                if (data == null)
                    return;
                $.each(data, function(k, v) {
                    self._data[k] = v;
                })
                self.highlight($(".ocr_line"));
            }
        });
    },


    highlight: function(lines) {
        var self = this;
        this._elements = [];
        lines.each(function(i, elem) {
            var badcount = 0;
            var nodes = [];
            var partial = document.createTextNode();            
            $.each($(elem).text().split(/\b/), function(i, word) {
                if (self._data[word]) {
                    badcount++;
                    if (partial.textContent != "undefined") {
                        nodes.push(partial);
                        partial = document.createTextNode();
                    }
                    var spellelem = $("<span></span>")
                        .addClass("badspell")
                        .text(word);
                    self._elements.push(spellelem.get(0));
                    nodes.push(spellelem.get(0));
                } else {
                    if (partial.textContent == "undefined") {
                        partial.textContent = word;                      
                    } else {
                        partial.textContent = partial.textContent + word;
                    }
                }        
            });
            if (partial.textContent != "undefined") {
                nodes.push(partial);
            }
            // FIXME: This is very inefficient because it 
            // rebuilds the nodes from scratch, while they're
            // live in the DOM.  Need to figure out a way of
            // doing it offline whilst maintaining a reference
            // to the spellcheck elems being inserted
            if (badcount) {
                $(elem).html("");
                for (var n in nodes) {
                    $(elem).append(nodes[n]);
                }
            }
        });
        if (this._celement < 0) {
            this.setNextSpellcheckWord();
        } else {
            this._logger("Setting current element!" + this._celement);
            this.setCurrentElement(this._celement);
        }
    },


    setNextSpellcheckWord: function(back) {
        if (this._elements.length) {
            var curr = this._celement;
            if (back) {
                curr = curr == 0
                    ? this._elements.length - 1
                    : curr - 1;
                this._logger("Decrementing celement" + curr);
            } else {
                curr = curr == this._elements.length - 1
                    ? 0
                    : curr + 1;
                this._logger("Incrementing celement" + curr);
            }
            this.setCurrentElement(curr);
        }
    },

    setCurrentElement: function(index) {
        //this._logger("Setting current index: " + index);                                  
        this._celement = index;
        var element = this._elements[this._celement];                                  
        $(this._elements).removeClass("current");
        $(element).addClass("current");
        element.scrollIntoView(false);

        this._lineedit.val($(element).text());
        this._lineedit.focus();
        this.updateSuggestions();
        this.callListeners("onWordHighlight", element);
    },


    updateSuggestions: function() {
        if (this._data[this._lineedit.val()]) {
            var suggestions = this._data[this._lineedit.val()].suggestions;
            this._suggestions.loadSuggestions(suggestions);
        } else {
            this._suggestions.clear();
        }
    },                           
                              

    doReplacement: function(shiftback) {                           
        // confirm a replacement
        var correctidx = this._celement;
        var correctelem = this._elements[this._celement];
        var correcttext = this._lineedit.val();
        if (correcttext && correctelem && $(correctelem).text() != correcttext) {
            var replacenode = document.createTextNode(correcttext);
            this._undostack.push(
                new ReplaceCommand(
                    this,
                    this._celement,
                    this._elements,
                    shiftback,
                    replacenode,
                    correctelem
                )
            );
            //correctelem.replaceWith(replacenode);
            this.callListeners("onWordCorrection");
        } else {
            this.setNextSpellcheckWord(shiftback);
        }
    },                           

    takeFocus: function(lines) {                           
        this._suggestions.enable();
        this._setupEvents();
        this._lineedit.focus().select();
        this._container.find("*").attr("disabled", false);
    },

    looseFocus: function(lines) {                    
        this._suggestions.disable();
        this._teardownEvents();
        this._lineedit.blur();        
        this._container.find("*").attr("disabled", true);
    },               
});
