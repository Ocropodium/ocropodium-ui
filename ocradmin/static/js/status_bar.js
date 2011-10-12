//
// Status bar widget
//

var OCRJS = OCRJS || {};

OCRJS.StatusBar = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.parent = parent;
        this._default = "Welcome to OWP";

        this._left = $("#status_message1", parent);
        this._right = $("#status_message2", parent);
        this._progress = $("#progress_bar_progress", parent);
        this._cancel = $("#progress_bar_cancel", parent);

        this._listeners = {
            messageChanged: [],
            progressChanged: [],
            cancel: [],
        };

        var self = this;
        this._cancel.bind("click", function(event) {
            self.callListeners("cancel");            
        }).bind("mouseenter", function(event) {
            $(this).addClass("hover");    
        }).bind("mouseleave", function(event) {
            $(this).removeClass("hover");    
        });

        this._right.css("visibility", "visible");        
    },

    setStatus: function(string) {
        this._left.text(string).css({
            color: "#333",
        });                    
    },

    clearStatus: function() {
        this._left.text(this._default).css(
            "color", this._left.css("backgroundColor"));        
    },                  

    setProgress: function(percent) {
        
    },

    setWorking: function(bool) {
        this._progress.add(this._cancel).toggleClass("working", bool);
    },                    

});
