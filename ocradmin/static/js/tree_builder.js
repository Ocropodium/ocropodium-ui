
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

OCRJS.TreeBuilder = OCRJS.OcrBase.extend({
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
        this._nodetemplate = $.template($("#nodeTmpl"));
        this._menutemplate = $.template($("#nodeMenuTmpl"));
        this._menu = null;
        this._nodedata = {};
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
        var self = this;
        console.log(self.parent);
        $(self.parent).noContext().rightClick(function(event) {
            self._menu.show();
            var maxx = $(self.parent).offset().left + $(self.parent).width();
            var left = event.clientX;
            if (event.clientX + self._menu.outerWidth() > maxx)
                left = maxx - (self._menu.outerWidth() + 20);
            self._menu.css({
                top: event.clientY,
                left: left,    
            });
        });
        $(self.parent).click(function(event) {
           self._menu.hide();
        });

        $(".node.floating").live("click", function(event) {
            $(this).removeClass("floating");
            $(document).unbind("mousemove.dropnode");
        });

    },                 

    setupMenuEvents: function() {
        var self = this;                         
        console.log("setup menu");         

        self._menu.find("li").hover(function(event) {
            $(this).addClass("ui-selected");
        }, function(event) {
            $(this).removeClass("ui-selected");
        });

        self._menu.find("li.topmenu").hover(function(event) {
            var pos = $(this).position();
            var left = pos.left + $(this).outerWidth() - 5;
            var sub = $(this).find("ul");
            sub.show();
            sub.css({left: left, top: $(this).position().top})
            var span = $(this).offset().left + $(this).outerWidth() + sub.outerWidth();
            var outer = $(self.parent).offset().left + $(self.parent).width();
            console.log("span", span, "doc", outer);
            if (span > outer) {
                console.log("moving left");
                sub.css("left", pos.left - sub.outerWidth());
            }
        }, function(event) {
            $(this).find("ul").delay(1000).hide();            
        });

        self._menu.find(".topmenu").find("li").click(function(event) {
            var node = self.createNode($(this).text());
            node.css({
                position: "absolute",
                left: event.clientX - (node.width() / 2),
                top: event.clientY - (node.height() / 2),
            });
            $(document).bind("mousemove.dropnode", function(e) {
                var con = self._constrainDrag({
                    left: e.clientX - (node.width() / 2),
                    top: e.clientY - (node.height() / 2),
                }, node, $(self.parent));
                node.css({
                    left: con.left,
                    top: con.top,
                });
            });
            self._menu.hide();
            event.stopPropagation();
            event.preventDefault();
        });

    },

    _constrainDrag: function(pos, node, parent) {
        var self = this;                        
        var left = pos.left;
        left = Math.max(left, parent.offset().left);
        left = Math.min(left, (parent.offset().left + parent.width()) - node.width());
        var top = pos.top;
        top = Math.max(top, $(self.parent).offset().top);
        top = Math.min(top, (parent.offset().top + parent.height()) - node.height());                
        return {left: left, top: top};
    },            

    createNode: function(name) {
        var self = this;
        console.log("Creating node: ", name);
        var nodeinfo;
        $.each(self._nodedata, function(stage, nodes) {
            if (!nodeinfo) {
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i].name == name) {
                        nodeinfo = nodes[i];
                        break;
                    }
                }
            }
        });
        return $.tmpl(self._nodetemplate, nodeinfo)
            .draggable({
                containment: self.parent,
                stack: ".node",
                cursor: "default",
            })
            .appendTo($(self.parent))
            .addClass("floating");
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
                self._nodedata = {};
                $.each(data, function(i, nodeinfo) {
                    if (!self._nodedata[nodeinfo.stage])
                        self._nodedata[nodeinfo.stage] = [];
                    self._nodedata[nodeinfo.stage].push(nodeinfo);
                });                
                self.buildNodeMenu();
                console.log("Building node menu");
                self._queryDone(parent.id);
            },
        });
    },

    buildNodeMenu: function() {
        var self = this;
        self._menu = $.tmpl(this._menutemplate, {
            stages: self._nodedata,
        }).hide();
        $(self.parent).append(self._menu);
        self.setupMenuEvents();
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

