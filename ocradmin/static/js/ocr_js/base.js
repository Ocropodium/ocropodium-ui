//
// Base class, with event handling functions, built
// on John Resig's class system.
//


/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
(function(){
  var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
  // The base Class implementation (does nothing)
  this.Class = function(){};
  
  // Create a new Class that inherits from this class
  Class.extend = function(prop) {
    var _super = this.prototype;
    
    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    var prototype = new this();
    initializing = false;
    
    // Copy the properties over onto the new prototype
    for (var name in prop) {
      // Check if we're overwriting an existing function
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && fnTest.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;
            
            // Add a new ._super() method that is the same method
            // but on the super-class
            this._super = _super[name];
            
            // The method only need to be bound temporarily, so we
            // remove it when we're done executing
            var ret = fn.apply(this, arguments);
            this._super = tmp;
            
            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }
    
    // The dummy class constructor
    function Class() {
      // All construction is actually done in the init method
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
    }
    
    // Populate our constructed prototype object
    Class.prototype = prototype;
    
    // Enforce the constructor to be what we expect
    Class.prototype.constructor = Class;

    // And make this class extendable
    Class.extend = arguments.callee;
    
    return Class;
  };
})();



var OcrJs = OcrJs || {};
OcrJs.Base = Class.extend({
    init: function() {
        this._listeners = {};
    },

    registerListener: function(key) {
        if (this._listeners[key] != undefined)
            throw "Listener already registered: '" + key + "'";
        this._listeners[key] = [];
        return this;
    },

    addListener: function(key, func, prepend) {
        if (!func)
            console.error("Adding null function listener for", key);
        var namespace = null;
        if (key.match(/^(.+)\.([^\.]+)$/))
            key = RegExp.$1, namespace = RegExp.$2;
        if (namespace) {
            func.__namespace = namespace;
        }
        if (this._listeners[key] == undefined)
            throw "Unknown callback: '" + key + "'";
        this._listeners[key][prepend ? "unshift" : "push"](func);
        return this;
    },

    addListeners: function(obj, prepend) {
        if (typeof obj != "object")
            throw "addListeners except an object parameter, got " + (typeof obj)
                + " instead";
        var self = this;
        $.each(obj, function(k, v) { self.addListener(k, v, prepend) });
        return this;
    },

    trigger: function() {
        var self = this;
        var args = Array.prototype.slice.call(arguments);
        var key = args.shift();
        if (this._listeners[key] == undefined)
            throw "Unknown callback: '" + key + "'";
        $.each(this._listeners[key], function(i, func) {
            func.apply(
                self, args.concat(Array.prototype.slice.call(arguments)));
        });
    },

    removeListeners: function(key, func) {
        var namespace = null;
        if (key.match(/^(.*)\.([^\.]+)$/))
            key = RegExp.$1, namespace = RegExp.$2;
        if (key != "" && this._listeners[key] === undefined) {
            console.error("Unknown callback:", key, this._listeners);
        }
        if (func) {
            var i = this._listeners[key].indexOf(func);
            if (i != -1)
                this._listeners[key].splice(i, 1);
        } else {
            var self = this;
            $.each(self._listeners, function(k, funcs) {
                if (key == "" || k == key) {
                    var temp = [];
                    $.each(funcs, function(i, f) {
                        if (!f)
                            console.error("Function is null!", k, namespace);
                        if (!f.__namespace || f.__namespace != namespace) {
                            temp.push(f);
                        }
                    });
                    self._listeners[k] = temp;
                }
            });
        }
    },
});

