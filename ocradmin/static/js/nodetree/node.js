//
// Class representing a node in a nodetree script.
// Nothing to do with the server-side JS engine.
//


var OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};

OCRJS.Nodetree.Node = OCRJS.OcrBase.extend({
    constructor: function(name, classdata) {
        this.base();
        this.name = name;
        this.type = classdata.name;
        this.arity = classdata.arity;
        this.desc = classdata.description;
        this.stage = classdata.stage;
        this.parameters = $.extend(true, [], classdata.parameters);
        this._ignored = false;
        this._focussed = false;
        this._viewing = false;

        this._tmpl = $.template($("#nodeTreeTmpl"));

        this.elem = this.buildElem();
        this.elem.data("nodedata", this);
        this.setupEvents();

        this._listeners = {
            toggleIgnored: [],
            toggleFocussed: [],
            toggleViewing: [],
            deleted: [],
            created: [],
        };    
    }, 

    buildElem: function() {
        return $.tmpl(this._tmpl, this);
    },

    setupEvents: function() {
        var self = this;                     
        this.elem.find(".ignorebutton").click(function(event) {
            self.setIgnored(!self._ignored, true);
            event.stopPropagation();
            event.preventDefault();
        });

        this.elem.find(".viewingbutton").click(function(event) {
            self.setViewing(!self._viewing, true);
            event.stopPropagation();
            event.preventDefault();
        });

        this.elem.click(function(event) {
            if (!self._focussed)
                self.setFocussed(true, true);
            event.stopPropagation();
            event.preventDefault();
        });
    },

    removeNode: function() {
        this.elem.remove();
        this.callListeners("deleted", this);
    },

    isIgnored: function() {
        return this._ignored;
    },

    setIgnored: function(ignored, emit) {
        this._ignored = typeof(ignored) === "undefined" ?  false : ignored;
        this.elem.find(".ignorebutton").toggleClass("active", this._ignored);
        if (emit) 
            this.callListeners("toggleIgnored", this, this._ignored);
    },

    setViewing: function(viewing, emit) {
        this._viewing = viewing || false;
        this.elem.find(".viewingbutton").toggleClass("active", this._viewing);
        if (emit) 
            this.callListeners("toggleViewing", this, this._viewing);
    },

    setFocussed: function(focus, emit) {
        this._focussed = focus || false;
        this.elem.toggleClass("current", this._focussed);
        if (emit) 
            this.callListeners("toggleFocussed", this, this._focussed);
    },

    setErrored: function(errored, msg) {
        this.elem.toggleClass("validation_error", errored);                    
        this.elem.attr("title", errored ? msg : this.description);    
    },
});
