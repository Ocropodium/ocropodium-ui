
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
            resultPending: [],
            registerUploader: [],
        };
        this._valuedata = valuedata || null;
        this._cache = null;
        this._temp = null;
        this._waiting = {};
        this._initialised = false;
        this._nodelisttmpl = $.template($("#nodeListTmpl"));
        this._nodetreetmpl = $.template($("#nodeTreeTmpl"));
        this._paramtmpl = $.template($("#paramTmpl"));
        this._nodedata = {};
        this._nodetypes = {};
        this._usednames = {};
        this._sessionid = null;
    },

    init: function() {
        var self = this;
        if (!self._initialised) {            
            //self.setupEvents();
            self._initialised = true;
        }
        self.queryOptions(null, null);
    },

    newNodeName: function(type) {
        var count = 1;
        var tname = $.trim(type);
        while (this._usednames[tname + count])
            count += 1;
        return tname + count;
    },

    removeNode: function(elem) {
        delete this._usednames[$(elem).attr("name")];
        $(elem).remove();
        this.scriptChange();        
    },

    selectLastNode: function() {
        $(".used li").last().click();        
    },                

    setupEvents: function() {
        var self = this;

        $("#run_script").click(function(event) {
            self.runScript();
            event.preventDefault();
        });

        // HACK: see:
        // http://stackoverflow.com/questions/5020695/jquery-draggable-element-no-longer-draggable-after-drop
        $.ui.draggable.prototype.destroy = function (ul, item) { };

        $(".available h4").click(function(event) {
            $(".available ul").not(this).hide();
            $(this).next("ul").show();

        });

        $(window).keydown(function(event) {
            if (event.which == KC_DELETE) {
                var current = $(".node.current");
                if (current.length == 0)
                    return;
                //if (confirm("Remove node: " + current.attr("name")))
                current.data("nodedata").removeNode();
            }
        });

        $(".nodelist.available").find("li.node").each(function(i, elem) {
            $(elem).draggable({
                scope: $(elem).data("stage"),
                    //helper: "clone",
                    helper: function() {
                        var helper = $(this).clone(true);
                        helper.text(
                            self.newNodeName($(this).data("type").replace(/^[^:]+::/, "")));
                        return helper.get(0);                                        
                    },
                    stop: function() {
                        console.log("drag stopped");
                        $(this).addClass("ui-draggable");
                    },
                    //connectToSortable: ".nodelist.used ul",
                    opacity: 0.8,        
                });
        });

        $(".nodelist.used ul").each(function(i, elem) {
            $(elem).droppable({
                hoverClass: "drop_target",
                scope: $(elem).data("stage"),
                activate: function(event, ui) {
                    $(this).addClass("drop_possible");
                },
                deactivate: function(event, ui) {
                    $(this).removeClass("drop_possible");
                },
                drop: function(event, ui) {
                    if (ui.draggable.hasClass("available")) {
                        var nodename = ui.helper.text();
                        var node = new OCRJS.Nodetree.Node(nodename, 
                                ui.draggable.data("nodedata"));
                        if ($(this).hasClass("multiple"))
                            node.elem.appendTo(this);
                        else
                            $(this).children().remove().end()
                                .append(node.elem);
                        self._usednames[nodename] = node;
                        self.setupNodeListeners(node);
                        node.elem.click();                        
                    }
                }, 
            }).sortable({
                containment: "parent",    
            });
        });
    },

    setupNodeListeners: function(node) {
        var self = this;                            
        node.addListeners({
            toggleIgnored: function(ig) {
                self.scriptChange();
            },
            toggleFocussed: function(foc) {
                $.each(self._usednames, function(name, other) {
                    console.log("Looking at other node: ", name);
                    if (node.name != name)
                        other.setFocussed(false);
                });
                self.buildParams(node.name, node.parameters);
                self.scriptChange();
            },
            toggleViewing: function(view) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != other.name)
                        other.setViewing(false);
                });
                self.scriptChange();
            },
            deleted: function() {
                console.log("Deleted node: ", node.name);
                self.scriptChange();
            },
        });
    },

    scriptChange: function() {
        this.runScript();
    },                 

    buildParams: function(name, params) {
        var self = this;
        $("input").unbind("keyup.paramval");
        $("#parameters").html("");
        $("#parameters").append(
            $.tmpl(self._paramtmpl, {
                nodename: name,
                params: params,
            })
        );
        // bind each param to its actual value
        $.each(params, function(i, param) {
            $("input#" + name + param.name).not(".proxy").bind("keyup.paramval", function(event) {
                console.log("updating val", param.name);
                params[i].value = $(this).val();
            });
            $("select#" + name + param.name + " input[type='hidden']")
                    .bind("change.paramval", function(event) {
                params[i].value = $(this).val();
            });
            $("input[type='file'].proxy").each(function(i, elem) {
                self.callListeners("registerUploader", elem);
            });
        });        
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
                    self._nodetypes[nodeinfo.name] = nodeinfo;
                });
                self.populateAvailableList();                
                self._queryDone(parent.id);
            },
        });
    },

    populateAvailableList: function() {
        var self = this;
        $.each(self._nodedata, function(stage, nodes) {
            $.each(nodes, function(i, node) {
                $(".available ul." + stage).append(
                    $.tmpl(self._nodelisttmpl, node)
                        .addClass("available")
                        .data("nodedata", node));
            });
        });
        $(".available ul").slice(1).hide();
        $(".available ul").filter(function() {
            return $(this).children().length > 0;
        }).first().show();

        self.setupEvents();
        self.loadState();

    },

    getEvalNode: function() {
        var node = $(".viewingbutton.active").first().parent();
        if (node.length == 0)
            node = $(".used ul li.current").first();
            if (node.length == 0)
                node = $(".used li.recognize").first();
                if (node.length == 0)
                    node = $(".used li.recognize").first();
                    if (node.length == 0)
                        node = $(".used ul li").last();
        return $.trim(node.data("nodedata").name);
    },                     

    runScript: function() {
        var self = this;                   
        var script = self.buildScript();
        var nodename = self.getEvalNode();
        $.ajax({
            url: "/plugins/run",
            type: "POST",
            data: {
                script: JSON.stringify(script),
                node: nodename,
            },
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                if (data.status == "VALIDATION") {
                    self._usednames[data.node].setErrored(true, data.error);
                } else {
                    $(".node.validation_error").each(function(i, elem) {
                        $(elem).data("nodedata").setErrored(false);
                    });
                    self.callListeners("resultPending", nodename, data);
                }
            },
        });
    },

    setFileInPath: function(path) {
        var node = $(".used ul.input li").first();
        if (node.length == 1) {
            var params = node.data("nodedata").parameters;
            for (var i in params) {
                if (params[i].name == "path")
                    params[i].value = path;
                break;
            }
        }
        this.scriptChange();
    },               

    // turn our GUI into an acceptable
    // script... hopefully...                           
    buildScript: function() {
        var self = this;
        var script = [];
        
        function scriptNode(node) {
            var arity = parseInt(node.arity);
            var args = Array.prototype.slice.call(arguments).slice(1, arity + 1);
            var params = [];
            $.each(node.parameters, function(i, p) {
                params.push([p.name, p.value]);
            });
            var out = {
                name: node.name,
                type: node.type,
                stage: node.stage,
                params: params,
                inputs: args,                    
            };
            if (node.isIgnored()) {
                out["ignored"] = true;
            }
            return out;
        }

        // this makes lots of assumptions about
        // where things are...
        var last = null, 
            segmenter = null,
            lastbinarizer = null,
            node = null;
        $(".nodelist.used ul")
                .filter(".input")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
            }).end().end()
                .filter(".filter_gray")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
            }).end().end()
                .filter(".binarize")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
            }).end().end()
                .filter(".filter_binary")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
                lastbinarizer = node.name;
            }).end().end()
                .filter(".page_segment")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                segmenter = node.name;
                last = node.name;
            }).end().end()
                .filter(".recognize")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(
                    scriptNode(node, lastbinarizer, segmenter));
            });
        return script;
    },

    loadScript: function(script) {
        var self = this;                    
        $.each(script, function(i, nodedata) {
            var typedata = self._nodetypes[nodedata.type];
            var node = new OCRJS.Nodetree.Node(nodedata.name, typedata);
            console.log("Creating node", nodedata.name, "Setting ignored", nodedata.ignored);
            node.setIgnored(nodedata.ignored);
            self._usednames[nodedata.name] = node;
            $.each(nodedata.params, function(i, p) {
                node.parameters[i].value = p[1];
            });
            $(".used ul." + typedata.stage)
                .append(node.elem);
            self.setupNodeListeners(node);
        });
        self.selectLastNode();
    },

    clearScript: function() {
        var self = this;
        self._usednames = {};
        $(".used li.node").remove();
    },               

    isReady: function() {
        return OCRJS.countProperties(this._waiting) > 0 ? false : true;
    },

    buildSection: function(parent, data) {
        var self = this;
    },                  

    saveState: function() {
        $.cookie("script", JSON.stringify(this.buildScript()));
    },

    loadState: function() {
        var self = this;                   
        var scriptjson = $.cookie("script");
        if (scriptjson) {
            var script = JSON.parse(scriptjson);        
            self.loadScript(script);
        }
        this._sessionid = $.cookie("sessionid") 
            || new Date().getTime(); 
    },               

    _queryDone: function(key) {
        delete this._waiting[key];                    
        if (this.isReady()) {
            $(this.parent).append(this._temp);
            this.callListeners("onReadyState"); 
        }
    },
});

