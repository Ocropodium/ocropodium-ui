
// Initialise OCRJS namespace
if (OCRJS === undefined) {
    var OCRJS = {};
}


OCRJS.OcrBase = Base.extend({
    constructor: function(options) {
        this._log = [];
        this.options = {
            log: false,
        }
        $.extend(this.options, options);        
        this._listeners = [];
    },

    _logger: function(arguments) {
        if (!this.options.log)
            return;
        console.log(arguments);
    },

    addListener: function(key, func) {
        if (this._listeners[key] == undefined)
            throw "Unknown callback: '" + key + "'";
        this._listeners[key].push(func);
    },

    callListeners: function() {
        var args = Array.prototype.slice.call(arguments);
        var key = args.shift();
        if (this._listeners[key] == undefined)
            throw "Unknown callback: '" + key + "'";
        $.each(this._listeners[key], function(i, func) {
            func.apply(
                func.callee, args.concat(Array.prototype.slice.call(arguments)));
        });
    },
                   
});


// Base widget for OCR items.  Just provides
// logging window facilities
OCRJS.OcrBaseWidget = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(options);
        this.parent = parent;
        this.options = {
            log: false,
        }
        $.extend(this.options, options);        
    },

    containerWidget: function() {
        return $(this.parent).closest(".widget");    
    },
});
