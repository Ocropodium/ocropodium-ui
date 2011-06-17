
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
        this._listeners = {};
    },

    _logger: function(arguments) {
        if (!this.options.log)
            return;
        console.log(arguments);
    },

    registerListener: function(key) {
        if (this._listeners[key] != undefined)
            throw "Listener already registered: '" + key + "'";
        this._listeners[key] = [];
        return this;        
    },

    addListener: function(key, func) {
        var namespace = null;                     
        if (key.match(/^(.+)\.([^\.]+)$/))
            key = RegExp.$1, namespace = RegExp.$2;
        if (namespace) {
            func.__namespace = namespace;
        }
        if (this._listeners[key] == undefined)
            throw "Unknown callback: '" + key + "'";
        this._listeners[key].push(func);
        return this;
    },

    addListeners: function(obj) {
        if (typeof obj != "object")
            throw "addListeners except an object parameter, got " + (typeof obj)
                + " instead";
        var self = this;
        $.each(obj, function(k, v) { self.addListener(k, v) });
        return this;
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

    removeListeners: function(key, func) {
        var namespace = null;                     
        if (key.match(/^(.*)\.([^\.]+)$/))
            key = RegExp.$1, namespace = RegExp.$2;
        if (this._listeners[key] == undefined)
            throw "Unknow callback: '" + key + "'";
        if (func) {
            var i = this._listeners[key].indexOf(func);
            if (i != -1)
                this._listeners.splice(i, 1);
            else
                console.error("Attempted to remove unknown listener callback");
        } else {
            var self = this;
            $.each(self._listeners, function(k, funcs) {
                if (k == "" || k == key) {
                    $.each(funcs, function(i, f) {
                        if (f.__namespace && f.__namespace == namespace) {
                            funcs.splice(i, 1);
                        }    
                    });   
                }
            });
        }            
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
