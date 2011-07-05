// 
// Basic parameter builder...
//

OCRJS.Nodetree.NodeList = OCRJS.OcrBaseWidget.extend({
    constructor: function(parent, valuedata) {
        this.base(parent);
        this.parent = parent;

        this._listeners = {
            onUpdateStarted: [],
            registerUploader: [],
            scriptChanged: [],
            scriptLoaded: [],
            scriptCleared: [],
            nodeMoved: [],
            nodeViewing: [],
            nodeFocussed: [],
            ready: [],
        };
        this._nodelisttmpl = $.template($("#nodeListTmpl"));
        this._nodetreetmpl = $.template($("#nodeTreeTmpl"));
        this._paramtmpl = $.template($("#paramTmpl"));
        this._nodeslottmpl = $.template($("#nodeSlots"));

        this._nodes = [];
        this._nodedata = {};
        this._nodetypes = {};
        this._usednames = {};
        this._sessionid = null;
    },

    init: function() {
        this.queryNodeTypes();
    },

    resetSize: function() {

    },

    setDisabled: function(bool) {

    },                     

    clearErrors: function() {
        $.map(this._nodes, function(n) {
            n.setErrored(false);
        });            
    },

    hasNodes: function() {
        return this._nodes.length > 0;
    },                  

    setNodeErrored: function(nodename, error) {
        if (!this._usednames[nodename])
            throw "Unknown node name: " + nodename;
        if (this._usednames[nodename])
            this._usednames[nodename].setErrored(true, error);
    },                        

    newNodeName: function(type) {
        var count = 1;
        var tname = $.trim(type.replace(/^[^:]+::/, ""));
        var space = type.match(/\d$/) ? "_" : "";
        while (this._usednames[tname + space + count])
            count += 1;
        return tname + space + count;
    },

    isValidNodeName: function(name, original) {
        if (name == original)
            return true;        
        if (name == "" || ~name.search(/\s/))
            return false;
        return !Boolean(this._usednames[name]);
    },

    renameNode: function(node, name) {
        this._usednames[name] = this._usednames[node.name];
        delete this._usednames[node.name];
        node.setName(name);        
    },                    

    removeNode: function(elem) {
        delete this._usednames[$(elem).attr("name")];
        var name = $(elem).attr("name");
        $(elem).remove();
        this.scriptChanged("Removed node: " + name);        
    },

    selectLastNode: function() {
        $(".used li").last().click();        
    },                

    setupEvents: function() {
        var self = this;

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
                        var node = self.addNode(ui.helper.text(), 
                                ui.draggable.data("nodedata"));
                        if ($(this).hasClass("multiple"))
                            node.elem.appendTo(this);
                        else
                            $(this).children().remove().end()
                                .append(node.elem);
                        node.elem.click();
                        self.scriptChanged("Node dropped on list");                        
                    }
                }, 
            }).sortable({
                containment: "parent",    
            });
        });
    },

    addNode: function(name, typedata) {
        var id = $.map(this._usednames, function(){return true;}).length;
        var node = new NT.Node(name, typedata, id);
        node.buildElem();
        this.setupNodeListeners(node);
        this._usednames[name] = node;
        this._nodes.push(node);
        return node;
    },                 

    setupNodeListeners: function(node) {
        var self = this;                            
        node.addListeners({
            toggleIgnored: function(ig) {
                self.scriptChanged("Toggled ignored: " + node.name);
            },
            toggleFocussed: function(foc) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != name)
                        other.setFocussed(false);
                });
                self.buildParams(node);
                self.callListeners("nodeFocussed", node);        
            },
            toggleViewing: function(view) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != other.name)
                        other.setViewing(false);
                });
                self.scriptChanged("Toggled viewing:" + node.name);
            },
            deleted: function() {
                console.log("Deleted node: ", node.name);
                self.scriptChanged("Deleted node: " + node.name);
            },
        });
    },

    setNodeErrored: function(nodename, error) {
        if (!this._usednames[nodename])
            throw "Unknown node name: " + nodename;
        this._usednames[nodename].setErrored(true, error);
    },                        

    scriptChanged: function(what) {
        console.log("running script");      
        this.callListeners("scriptChanged", what);
    },

    buildParams: function(node) {
        var self = this;
        console.log("Setting parameter listeners for", node.name, node.parameters);
        // if we've already got a node, unbind the update
        // handlers
        if ($("#parameters").data("node")) {
            $("#parameters").data("node").removeListeners(".paramobserve");
            $("#parameters").data("node", node);
        }
        $("#parameters").html("");
        var inputs = [];
        for (var i = 0; i < node.arity; i++)
            inputs.push(i);
        $("#parameters").append($.tmpl(self._paramtmpl, {
            nodename: node.name,
            nodetype: node.type.replace(/^[^:]+::/, ""),
            node: node,
            parameters: node.parameters,
            inputs: inputs, 
        }));
        $("input").unbind("keyup.paramval");
        $("input.nameedit").bind("keyup.paramval", function(event) {
            var val = $.trim($(this).val());
            if (self.isValidNodeName(val)) {
                $(this).removeClass("invalid");
                self.renameNode(node, val); 
            } else {
                $(this).addClass("invalid");
            }
        });
        // bind each param to its actual value
        $.each(node.parameters, function(i, param) {
            $("input[type='text']#" + node.name + param.name).not(".proxy").each(function(ii, elem) {
                $(elem).bind("keyup.paramval", function(event) {
                    node.parameters[i].value = $(this).val();
                });
                node.addListener("parameterUpdated_" + param.name + ".paramobserve", function(value) {
                    $(elem).val(value);
                });
            });
            $("input[type='checkbox']#" + node.name + param.name).not(".proxy").each(function(ii, elem) {
                $(elem).bind("change.paramval", function(event) {
                    node.parameters[i].value = $(this).prop("checked");
                });
                node.addListener("parameterUpdated_" + param.name + ".paramobserve", function(value) {
                    $(elem).prop("checked");
                });
            });
            $("select#" + node.name + param.name + ", input[type='hidden']#" + node.name + param.name).each(function(ii, elem) {
                $(elem).bind("change.paramval", function(event) {
                    node.parameters[i].value = $(this).val();
                });
                node.addListener("parameterUpdated_" + param.name + ".paramobserve", function(value) {
                    $(elem).val(value);
                });
            });
            $("input[type='file'].proxy").each(function(ii, elem) {
                self.callListeners("registerUploader", node.name, elem);
            });
            if ($("#switch").length) {
                $("#switch", "#parameters").buttonset();
                $("input[type='radio']").change(function(event) {
                    node.parameters[i].value = parseInt(
                        $("input[name='" + node.name + "input']:checked").val());
                    self.scriptChanged();
                });
            }
        });
    },

    clearParams: function() {
        $("input, select", $("#parameters")).unbind(".paramval");
        $("#parameters").data("node", null);
        $("#parameters").html("<h1>No Node Selected</h1>");
        this.callListeners("nodeFocussed", null);
    },                     

    queryNodeTypes: function() {
        var self = this;
        var url = "/presets/query/";
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
                self.populateCanvas();
            },
        });
    },

    populateCanvas: function() {
        $(this.parent).html("");
        $(this.parent).append($.tmpl(this._nodeslottmpl));
        this.populateAvailableList();
        this.setupEvents();
        this.callListeners("ready");                
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
    },

    getEvalNode: function() {
        for (var i in this._nodes) {
            if (this._nodes[i].isViewing())
                return this._nodes[i].name;
        }    
        for (var i in this._nodes) {
            if (this._nodes[i].isFocussed())
                return this._nodes[i].name;
        }    
        for (var i in this._nodes) {
            if (this._nodes[i].stage == "recognize")
                return this._nodes[i].name;
        }    
        // fall back on the last node in the list
        var last = this._nodes[this._nodes.length - 1];
        if (last)
            return last.name;
    },

    getNode: function(nodename) {
        return this._usednames[nodename];
    },                 

    setFileInPath: function(name, path) {
        console.log("Setting filein path", name, path);                       
        for (var n in this._nodes) {
            if (this._nodes[n].name == name) {
                var params = this._nodes[n].parameters;
                for (var i in params) {
                    console.log("Setting", params[i].name, path)
                    if (params[i].name == "path")
                        params[i].value = path;
                    break;
                }                
            }                
        }            
        this.scriptChanged("Set file in path: " + name);
    },               

    // turn our GUI into an acceptable
    // script... hopefully...                           
    buildScript: function() {
        var self = this;
        var script = {};
        
        function scriptNode(node) {
            var arity = parseInt(node.arity);
            var args = Array.prototype.slice.call(arguments).slice(1, arity + 1);
            var params = [];
            $.each(node.parameters, function(i, p) {
                params.push([p.name, p.value]);
            });
            var out = {
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
                script[node.name] = scriptNode(node, last);
                last = node.name;
            }).end().end()
                .filter(".filter_gray")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script[node.name] = scriptNode(node, last);
                last = node.name;
            }).end().end()
                .filter(".binarize")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script[node.name] = scriptNode(node, last);
                last = node.name;
            }).end().end()
                .filter(".filter_binary")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script[node.name] = scriptNode(node, last);
                last = node.name;
                lastbinarizer = node.name;
            }).end().end()
                .filter(".page_segment")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script[node.name] = scriptNode(node, last);
                segmenter = node.name;
                last = node.name;
            }).end().end()
                .filter(".recognize")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script[node.name] = scriptNode(node, lastbinarizer, segmenter);
            });
        return script;
    },

    loadScript: function(script) {
        var self = this;                    
        $.each(script, function(name, nodedata) {
            if (name != "__meta") {
                var typedata = self._nodetypes[nodedata.type];
                var node = self.addNode(name, typedata);
                node.setIgnored(nodedata.ignored);
                $.each(nodedata.params, function(i, p) {
                    node.parameters[i].value = p[1];
                });
                $(".used ul." + typedata.stage)
                    .append(node.elem);
            }
        });
        this.selectLastNode();
        this.callListeners("scriptLoaded");
    },

    clearScript: function() {
        var self = this;
        $.each(this._nodes, function(i, n) {
            n.removeNode(true);
        });
        this._usednames = {};        
        this._nodes = [];
        this.callListeners("scriptCleared");
        
    },               

    buildSection: function(parent, data) {
        var self = this;
    },                  
});

