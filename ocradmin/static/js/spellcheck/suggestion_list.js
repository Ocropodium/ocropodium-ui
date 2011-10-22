// Spellcheck widget suggestion list

OcrJs.SuggestionList = OcrJs.Base.extend({
    constructor: function(parent, options) {
        this.base(options);
        this.parent = parent;

        this._focus = false;
        this._container = $("<div></div>")
            .attr("id", "sp_suggestionlist");

    },


    _setupEvents: function() {
        var self = this;

        // events
        $(".sp_suggestion", this._container).live("click", function(event) {
            self.selectSuggestion($(this));
        });

        $(".sp_suggestion", this._container).live("dblclick", function(event) {
            self.suggestionChosen($(this).text());
        });
    },


    _teardownEvents: function() {
        $(".sp_suggestion", this._container)
            .die("click")
            .die("dblclick");
    },                 


    init: function(parent) {
        this.parent = parent;
        this._setupEvents();            
        this._container.appendTo($(this.parent));
    },
          

    loadSuggestions: function(suggestions) {
        this._container.html("");
        if (suggestions) {
            var tsugg = $("<div></div>")
                .addClass("sp_suggestion");
            for (var i in suggestions) {
                this._container.append(                        
                    tsugg.clone().text(suggestions[i])
                );
            }
        }
    },


    selectSuggestion: function(sel) {
        $(".ui-selected", this._container).removeClass("ui-selected");
        sel.addClass("ui-selected");
        if (sel.length) {
            if(sel.get(0))
                sel.get(0).scrollIntoView(false);
            this.suggestionSelected(sel.text());
        }
    },


    clearSelection: function() {
        $(".ui-selected", this._container).removeClass("ui-selected");
    },


    clear: function() {
        this._container.html("");
    },


    keyEvent: function(event) {
        switch (event.keyCode) {
            case KC_DOWN:
                var sel = $(".ui-selected", this._container).next();
                if (sel.length == 0) {
                    sel = $(".sp_suggestion", this._container).first();
                }
                this.selectSuggestion(sel);
                break;
            case KC_UP:                                      
                var sel = $(".ui-selected", this._container).prev();
                if (sel.length == 0) {
                    this.looseFocus();
                }
                this.selectSuggestion(sel);
                break;
            case KC_RETURN:
                var sel = $(".ui-selected", this._container).first();
                this.suggestionChosen(sel.text());
                break;
            case KC_ESCAPE:
                this.looseFocus();
                break;
            default:
                return true;
        }
        event.preventDefault();
    },


    navigateList: function(event) {
        if (!this._focus) {
            this._focus = true;
            this._container.addClass("focus");
            this.focusTaken();
        }
        this.keyEvent(event);
    },
    

    looseFocus: function() {
        this._focus = false;
        $(".ui-selected", this._container).removeClass("ui-selected");         
        this._container.removeClass("focus");
        this.focusLost();
    },


    hasFocus: function() {
        return this._focus;
    },


    currentSelection: function() {
        return $(".ui-selected", this.parent).text();
    },

    disable: function() {
        this._teardownEvents();                 
        this._container.addClass("disabled")
    },

    enable: function() {
        this._setupEvents();
        this._container.removeClass("disabled");
    },             

    suggestionChosen: function(word) {
        // typically overridden...
        this.looseFocus();
    },


    focusTaken: function(event) {

    },


    focusLost: function(event) {

    },


    suggestionSelected: function(word) {

    },
});

