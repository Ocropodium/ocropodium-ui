
RegExp.escape = function(text) {
  if (!arguments.callee.sRE) {
    var specials = [
      '/', '.', '*', '+', '?', '|',
      '(', ')', '[', ']', '{', '}', '\\'
    ];
    arguments.callee.sRE = new RegExp(
      '(\\' + specials.join('|\\') + ')', 'g'
    );
  }
  return text.replace(arguments.callee.sRE, '\\$1');
}

function toCamelCase(str) {
    return str.replace(/_/g, " ").replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}


function defined(x) {
    return typeof(x) !== "undefined";
}

function isnull(x) {
    return x === null;
}


OCRJS = OCRJS || {};
OCRJS.countProperties = function(obj) {
    var count = 0;
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            ++count;
        }
    }
    return count;
};


OCRJS._ajaxCache = {};

OCRJS.ParameterBuilder = OCRJS.OcrBase.extend({
    constructor: function(parent, valuedata) {
        this.base(parent);
        this.parent = parent;

        this._listeners = {
            onReadyState: [],
            onUpdateStarted: [],
        };
        this._valuedata = valuedata || null;
        this._cache = null;
        this._temp = null;
        this._waiting = {};
        this._initialised = false;
        this._nodetemplate = $.template($("#nodeTemplate"));
    },

    init: function() {
        var self = this;
        if (!self._initialised) {            
            self.setupEvents();
            self._initialised = true;
        }
        self.queryOptions(null, null);
    },

    setupEvents: function() {

    },                 

    isReady: function() {
        return OCRJS.countProperties(this._waiting) > 0 ? false : true;
    },

    queryOptions: function(parent) {
        var self = this;
        var parent = parent || self.parent;
        var url = "/plugins/query/";
        self._waiting[parent.id] = true;
        self.callListeners("onUpdateStarted"); 
        $.ajax({
            url: url,
            type: "GET",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                self._temp = self.buildSection(parent, data)
                self._queryDone(parent.id);
            },
        });
    },

    buildSection: function(parent, data) {
        var self = this;
        $.each(data, function(i, nodeinfo) {        
            var d = $.tmpl(self._nodetemplate, nodeinfo);
            console.log(d);
            $(parent).append(d);                      
        });
    },                  

    saveState: function() {
    },

    _queryDone: function(key) {
        delete this._waiting[key];                    
        if (this.isReady()) {
            $(this.parent).append(this._temp);
            this.callListeners("onReadyState"); 
        }
    },
});

