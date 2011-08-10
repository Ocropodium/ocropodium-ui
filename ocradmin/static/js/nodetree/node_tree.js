//
// Fancy pants parameter tree.
//

var OCRJS = OCRJS || {}
var NT = OCRJS.Nodetree;
var SvgHelper = SvgHelper || new OCRJS.Nodetree.SvgHelper();


OCRJS.AddNodeCommand = OCRJS.UndoCommand.extend({
    constructor: function(tree, name, type, atpoint, context) {
        this.base("Add Node");
        console.log("Adding node", name);
        
        this.redo = function() {
            var node = tree.createNode(name, tree._nodetypes[type]);
            node.moveTo(atpoint.x - (node.width / 2), atpoint.y - (node.height / 2));
            tree.registerNode(node);

        };
        this.undo = function() {
            var node = tree._usednames[name];
            tree.unregisterNode(node);
            tree.deleteNode(node);
        };
    }
});

OCRJS.DeleteNodeCommand = OCRJS.UndoCommand.extend({
    constructor: function(tree, name) {
        this.base("Delete Node: " + name);
        var data = tree._usednames[name].serialize();
        this.redo = function() {
            var node = tree._usednames[name];
            tree.unregisterNode(node);
            tree.deleteNode(node);
        };
        this.undo = function() {
            var newnode = tree.createNode(name, tree._nodetypes[data.type]);
            newnode.deserialize(data);
            tree.registerNode(newnode);            
        };            
    },                     
});    

OCRJS.ConnectPlugsCommand = OCRJS.UndoCommand.extend({
    constructor: function(tree, src, dst) {
        this.base("Connect Plugs");
        console.log("Connecting plugs", src, dst);        
        console.assert(dst instanceof OCRJS.Nodetree.InPlug, "Destination is not an input plug.");
        this.redo = function() {
            tree._connectPlugs(src, dst);
        };

        this.undo = function() {
            dst.detach();
        };
    }        
});

OCRJS.DetachPlugCommand = OCRJS.UndoCommand.extend({
    constructor: function(tree, plug) {
        this.base("Detach Plug");
        console.assert(plug.isAttached(), "Plug is not attached.");
        console.assert(plug instanceof OCRJS.Nodetree.InPlug, "Attempt to detach a non-input plug.");
        var origin = plug.cable().start;
        this.redo = function() {
            plug.detach();    
        };

        this.undo = function() {
            console.log("Reconnecting detached plugs", origin.name, plug.name);
            tree._connectPlugs(origin, plug);
        };            
    },
});    
                     

OCRJS.Nodetree.NodeTree = OCRJS.OcrBaseWidget.extend({
    constructor: function(parent, options) {
        this.base(parent, options);

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

        this.parent = parent;
        this.svg = null;

        this._nodes = [];
        this._nodedata = {};
        this._nodetypes = {};
        this._usednames = {};

        this._dragcable = null;
        this._multiselect = false;
        this._menu = null;
        this._menucontext = null;
        this._menutemplate = $.template($("#nodeMenuTmpl"));
        this._minzoom = 0.1;
        this._maxzoom = 7;
        this._undostack = new OCRJS.UndoStack(this);
    },


    init: function() {
        this.queryNodeTypes();
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

    clearScript: function() {
        var self = this;
        $.each(this._nodes, function(i, n) {
            n.removeNode(true);
        });
        this._usednames = {};        
        this._nodes = [];
        this.callListeners("scriptCleared");
        
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

    resetSize: function() {                           
        var svg = $(this.parent).find("svg");
        svg
            .attr("width", Math.max($(this.parent).width(), svg.attr("width")))
            .attr("height", Math.max($(this.parent).height(), svg.attr("height")));
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

    group: function() {
        return this._group;
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

    setupNodeListeners: function(node) {
        var self = this;                            
        node.addListeners({
            "toggleIgnored.tree": function(ig) {
                self.scriptChanged("Toggled ignored: " + node.name);
            },
            "toggleFocussed.tree": function() {
                if (!self._multiselect) {
                    $.each(self._nodes, function(i, other) {
                        if (node != other)
                            other.setFocussed(false);
                    });
                    self.buildParams(node);
                    self.callListeners("nodeFocussed", node);        
                }
            },
            "toggleViewing.tree": function(view) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != other.name)
                        other.setViewing(false);
                });
                self.scriptChanged("Toggled viewing: " + node.name);
            },
            "moving.tree": function() {
                // when the node is being dragged, also move any others
                // that are selected
                // FIXME: This seems an awfully inefficient way of doing
                // things but it's much less complicated than doing funky
                // things with adding/removing transformation groups                        
                if (!node.isFocussed())
                    return;
                var trans = SvgHelper.getTranslate(node.group());
                node.addListener("moved.dragmulti", function() {
                    var newtrans = SvgHelper.getTranslate(node.group());
                    $.each(self._nodes, function(i, other) {
                        if (other != node && other.isFocussed()) {
                            other.moveBy(
                                newtrans.x - trans.x, newtrans.y - trans.y);
                        }
                    });
                    trans = newtrans;                    
                });
            },
            "dropped.tree": function() {
                node.removeListeners("moved.dragmulti");
                self.callListeners("nodeMoved", node);
            },
            "deleted.tree": function() {
                console.log("Deleted node:", node.name);
                self.scriptChanged("Deleted: " + node.name);
            },
            "clicked.tree": function(event) {
                if (self._menucontext)
                    return self.hideContextMenu();                    
                if (event.shiftKey)
                    node.setFocussed(!node.isFocussed(), true);
                else
                    node.setFocussed(true, true);
            },
            "rightClicked.tree": function(event) {
                self._menucontext = node;
                self.showContextMenu(event);
            },
            "inputAttached.tree": function(plug) {
                console.log("Attached input to", node.name, plug.name);
                self.handlePlug(plug);
            },                               
            "outputAttached.tree": function(plug) {
                console.log("Attached output to", node.name, plug.name);
                self.handlePlug(plug);
            },
            "plugHoverIn.tree": function(plug) {
                self.handlePlugHover(plug);
            },
            "plugRightClicked.tree": function(plug, event) {
                self._menucontext = plug;
                self.showContextMenu(event);
            },                                  
        });
    },

    teardownNodeListeners: function(node) {
        node.removeListeners(".tree");
    },                               

    removeDragCable: function() {
        if (this._dragcable) {
            this._dragcable.start.setDefaultState();
            this._dragcable.remove();
            this._dragcable = null;
        }
        $(document).unbind(".dragcable").unbind(".dropcable");
    },

    detachPlug: function(plug) {
        this._undostack.push(new OCRJS.DetachPlugCommand(this, plug));
    },                    

    handlePlug: function(plug) {
        var self = this;
        if (!self._dragcable && plug.isInput() && plug.isAttached()) {
            this.detachPlug(plug);
            self.startCableDrag(plug);
        } else if (!self._dragcable) {
            self.startCableDrag(plug);
        } else {
            if (self._dragcable.start.wouldAccept(plug)) {
                this._undostack.beginMacro("Connect Plugs");
                if (plug.isInput() && plug.isAttached())
                    this.detachPlug(plug);
                if (self._dragcable.start.isInput())
                    self.connectPlugs(plug, self._dragcable.start);
                else
                    self.connectPlugs(self._dragcable.start, plug);
                this._undostack.endMacro();
                self.scriptChanged("Plugged: " + plug.name);
            }
            self.removeDragCable();    
        }            
    },

    handlePlugHover: function(plug) {
        var self = this;
        if (self._dragcable) {
            var other = self._dragcable.start;
            if (plug.wouldAccept(other)) {
                plug.setAcceptingState();
            } else {
                plug.setRejectingState();
            }
        } else {
            plug.setAcceptingState();
        }            
    },                         

    startCableDrag: function(plug) {
        var self = this;                        
        var cable = new NT.DragCable(plug);
        var point = SvgHelper.denorm(plug.centre(), plug.group(), self.group());
        cable.draw(self.svg, self._cablegroup, point, point);
        self._dragcable = cable;
        plug.setDraggingState();
        $(document).bind("mousemove.dragcable", function(event) {
            var npoint = SvgHelper.denorm(plug.centre(), plug.group(), self.group());
            var nmp = SvgHelper.mouseCoord(self.parent, event);
            cable.update(npoint, self.relativePoint(nmp));
        }); 
        $(self.parent).bind("click.dropcable", function(event) {
            self.removeDragCable();
        });
    },

    connectPlugs: function(src, dst) {
        this._undostack.push(new OCRJS.ConnectPlugsCommand(this, src, dst));
    },


    disconnectNode: function(node) {
        // when we're about to delete a node, clean
        // up its cables
        // check if we've got an input                
        var self = this;                        
        console.log("Delete initiated:", node.name);
        var outplug = node.output();
        var referencees = self.attachedInputs(outplug);
        for (var i in referencees)
            this.detachPlug(referencees[i]);
        var input = node.input(0);
        if (!input || !input.isAttached())
            return;
        if (input.isAttached()) {
            var srcplug = input.cable().start;
            this.detachPlug(input);
            for (var i in referencees) {
                self.connectPlugs(srcplug, referencees[i]);
            }
        }
    },

    attachedInputs: function(outplug) {
        // since output plugs have no knowledge of what's
        // attached to them we have to search all the nodes
        // to find any that reference a given output.                        
        var inplugs = [];
        $.each(this._nodes, function(ni, node) {
            $.each(node.inputs(), function(i, input) {
                if (input.isAttached() && input.cable().start == outplug)
                    inplugs.push(input);
            });                
        });            
        return inplugs;
    },                        

    setupEvents: function() {
        var self = this;                     
        $(self.parent).noContext().rightClick(function(event) {
            self._menucontext = null;
            self.showContextMenu(event);
        });

        $(self.parent).click(function(event) {
            if (!event.shiftKey)
                self.deselectAll();
        });

        function nodeCmd(event) {
            if (event.which == 61 || event.which == 45) {                    
                self.keyZoom(event.which == 61 ? 1.5 : 0.75);
            }
        }
        $(self.parent).bind("mousewheel.zoomcanvas", function(event, delta) {
            self.mouseZoom(event, delta);
        });
        $(this.parent).bind("mousedown", function(event) {
            if (event.button == 1 || event.button == 0 && event.shiftKey && event.ctrlKey) {
                self.panContainer(event);
                event.stopPropagation();
                event.preventDefault();
            } else if (event.button == 0) {
                self.lassoSelect(event);    
            }                
        });

        $(self.parent).bind("mouseenter", function(mvevent) {
            $(document).bind("keypress.nodecmd", function(event) {
                nodeCmd(event);
            });
            $(document).bind("keydown.nodecmd", function(event) {
                if (event.which == KC_DELETE)
                    self.deleteSelected();
                else if (event.which == KC_SHIFT)
                   self._multiselect = true;
                else if (event.which == KC_HOME)
                    self.centreTree();
                else if (event.ctrlKey && event.which == 65) { // 'L' key                 
                    self.selectAll(); 
                    event.preventDefault();
                    event.stopPropagation();
                } else if (event.ctrlKey && event.keyCode == 90) {
                    if (!event.shiftKey) {
                        self._undostack.undo();
                    } else {
                        self._undostack.redo();
                    }
                } else if (event.ctrlKey && event.which == 76) // 'L' key
                    self.layoutNodes(self.buildScript()); 
            });
            $(document).bind("keyup.nodecmd", function(event) {
                if (event.which == KC_SHIFT)
                   self._multiselect = false;
            });
        });        
        $(self.parent).bind("mouseleave", function(mvevent) {
            $(document).unbind(".nodecmd");
            $(document).unbind("mousewheel.zoomcanvas");
            $(document).unbind("mousemove.debug");
        });
    },

    getTreeBounds: function() {
        var l, t, r, b;
        $.each(this._nodes, function(i, node) {
            var trans = SvgHelper.getTranslate(node.group());
            if (i == 0) {
                l = trans.x;
                t = trans.y;
                r = trans.x + node.width;
                b = trans.y + node.height;    
            } else {
                l = Math.min(l, trans.x);
                t = Math.min(t, trans.y);
                r = Math.max(r, trans.x + node.width);
                b = Math.max(b, trans.y + node.height);        
            }                
        });
        return {l: l, t: t, r: r, b: b};
    },                       

    centreTree: function() {
        // centre the tree in the viewport
        if (this._nodes.length == 0)
            return;
        
        var border = 25;
        var tw = $(this.parent).width() - (2 * border),
            th = $(this.parent).height() - (2 * border);

        var ctrans = SvgHelper.getTranslate(this.group());
        var bounds = this.getTreeBounds();

        // now determine what zoom/translate we need to 
        // centre l, t, r & b
        var w = (bounds.r - bounds.l), h = (bounds.b - bounds.t);
        var tscalex = tw / w, tscaley = th / h;
        var usedscale = Math.min(1, (Math.min(tscalex, tscaley))).toFixed(2);

        // now determine where to translate the canvas to centre the tree
        var xrealpos = (tw - w * usedscale) / 2;
        var yrealpos = (th - h * usedscale) / 2;            
        transx = border + (xrealpos - (bounds.l * usedscale));
        transy = border + (yrealpos - (bounds.t * usedscale));

        SvgHelper.updateScale(this.group(), usedscale, usedscale);
        SvgHelper.updateTranslate(this.group(), transx, transy);
    },                    

    deselectAll: function() {
        $.map(this._nodes, function(n) {
            n.setFocussed(false);
        });
        this.clearParams();
        this.callListeners("nodeFocussed", null);
    },

    selectAll: function() {
        $.map(this._nodes, function(n) {
            n.setFocussed(true);
        });
    },    

    setupMenuEvents: function() {
        var self = this;
        self._menu.find("li").hover(function(event) {
            $(this).addClass("ui-selected");
        }, function(event) {
            $(this).removeClass("ui-selected");
        });
        self._menu.find("li.topmenu").hoverIntent(
            function(event) {
                self.showSubContextMenu(this, event);
            },
            function(event) {
                $(this).find("ul").delay(1000).hide();            
            }
        );

        self._menu.find(".topmenu").find("li").click(function(event) {
            self.createNodeAtPoint($(this).data("name"), 
                    SvgHelper.mouseCoord(self.parent, event), self._menucontext);
            self.hideContextMenu();
            event.stopPropagation();
            event.preventDefault();
        });
    },

    showContextMenu: function(event) {
        var self = this;                         
        this._menu.show();
        var maxx = $(this.parent).offset().left + $(this.parent).width();
        var left = event.pageX;
        if (event.pageX + this._menu.outerWidth() > maxx)
            left = maxx - (this._menu.outerWidth() + 20);
        this._menu.css({
            position: "fixed",
            top: event.pageY,
            left: left,    
        });
        $(document).bind("click.menuhide", function(event) {
            self.hideContextMenu();            
            $(document).unbind("click.menuhide");
            event.stopPropagation();
            event.preventDefault();
        });
    },                         

    showSubContextMenu: function(menu, event) {
        var pos = $(menu).position();
        var left = pos.left + $(menu).outerWidth() - 5;
        var sub = $(menu).find("ul");
        sub.show();
        sub.css({left: left, top: $(menu).position().top})
        var span = $(menu).offset().left + $(menu).outerWidth() + sub.outerWidth();
        var outer = $(this.parent).offset().left + $(this.parent).width();
        if (span > outer) {
            sub.css("left", pos.left - sub.outerWidth());
        }
    },

    hideContextMenu: function(event) {
        this._menu.hide();
        this._menucontext = null;
    },                         

    buildNodeMenu: function() {
        var self = this;
        // do some munging of the node data so we sort the menu
        // in alphabetical stage order;
        var stages = $.map(this._nodedata, function(nodes, stage) {
            return {
                name: stage,
                nodes: nodes,
            };
        });
        stages.sort(function(a, b) {
            return a.name > b.name;
        });
        $.each(stages, function(i, s) {
            s.nodes.sort(function(a, b) {
                return a.name > b.name;
            });
        });
        self._menu = $.tmpl(this._menutemplate, {
            stages: stages,
        }).hide();
        $("body").append(self._menu);
        self.setupMenuEvents();
    },    

    populateCanvas: function() {
        var self = this;                        
        $(this.parent).svg({                    
            onLoad: function(svg) {
                self.svg = svg;
                self.drawTree();
                self.setupEvents();
                self.buildNodeMenu();
                self.callListeners("ready");
            },
        });
    },

    loadScript: function(script) {
        var self = this;
        this.resetCanvas();
        var havemeta = false;
        this._scriptmeta = script.__meta;
        delete script["__meta"];
        $.each(script, function(name, node) {
            var typedata = self._nodetypes[node.type];
            var newnode = self.createNode(name, typedata);
            self.registerNode(newnode);
            newnode.setIgnored(node.ignored);
            $.each(node.params, function(i, p) {
                newnode.parameters[i].value = p[1];
            });
            if (node.__meta) {
                havemeta = true;
                newnode.moveTo(node.__meta.x, node.__meta.y);
                newnode.setViewing(node.__meta.viewing);
                newnode.setFocussed(node.__meta.focussed);
            }
        });
        this.connectNodes(script);
        if (!havemeta)
            this.layoutNodes(script);
        this.callListeners("scriptLoaded");
    },                    

    createNode: function(name, typedata) {                         
        var id = $.map(this._usednames, function(){return true;}).length;
        var node = new NT.TreeNode(name, typedata, id);
        node.draw(this.svg, this._group, 0, 0);
        return node;
    },

    registerNode: function(node) {
        this.setupNodeListeners(node);
        this._usednames[node.name] = node;
        this._nodes.push(node);
    },                      

    unregisterNode: function(node) {
        this.teardownNodeListeners(node);
        delete this._usednames[node.name];
        var i = this._nodes.indexOf(node);
        console.assert(i > -1, "Node", node.name, "not found in self._nodes");
        this._nodes.splice(i, 1);
    },                        

    lassoSelect: function(event) {                             
        var self = this;
        var trans = SvgHelper.getTranslate(self.group());
        var scale = SvgHelper.getScale(self.group());
        var start = self.relativePoint(
                SvgHelper.mouseCoord(self.parent, event));
        var lasso = null;
        $(document).bind("mousemove.lasso", function(mevent) {
            var end = self.relativePoint(
                    SvgHelper.mouseCoord(self.parent, mevent));
            var rect = SvgHelper.rectFromPoints(start, end);
            if (!lasso && Math.sqrt(rect.width^2 + rect.height^2) > 5) {
                lasso = self.svg.rect(self.group(), rect.x, rect.y, 
                            rect.width, rect.height, 0, 0, {
                        fill: "none",
                        stroke: "#000",
                        strokeWidth: 1 / scale, 
                        strokeDashArray: (2 / scale) + "," + (2 / scale),
                });
            }
            if (lasso) {
                self.svg.change(lasso, {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                });
            }
        });
        $(document).bind("mouseup.lasso", function(uevent) {
            if (lasso) {
                var got = self.lassoNodes($(lasso));
                if (self._multiselect)
                    $.map(got, function(n) { n.setFocussed(true); });
                else {
                    $.each(self._nodes, function(i, n) {
                        n.setFocussed(Boolean(~$.inArray(n, got)));
                    });
                }
                self.svg.remove(lasso);
            }
            $(document).unbind(".lasso");
            event.stopPropagation();
            event.preventDefault();
        });        
    },

    lassoNodes: function(lasso) {
        // lasso nodes overlapping the lasso box
        var rect = {};
        $.each(["x", "y", "width", "height"], function(i, v) {
            rect[v] = parseInt($(lasso).attr(v));
        });
        var trans, nodes = [];
        $.each(this._nodes, function(i, node) {
            trans = SvgHelper.getTranslate(node.group());
            if (SvgHelper.rectsOverlap(rect, {
                x: trans.x, y: trans.y, width: node.width, height: node.height,
            })) nodes.push(node);
        });
        return nodes;        
    },

    unfocusAllNodes: function() {
        $.map(this._nodes, function(n) { n.setFocussed(false); });
    },                         

    relativePoint: function(point) {
        var scale = SvgHelper.getScale(this.group());
        var trans = SvgHelper.getTranslate(this.group());
        return {
            x: (point.x - trans.x) / scale,
            y: (point.y - trans.y) / scale
        };
    },    

    replaceNode: function(src, dst) {
        var outs = [];
        for (var i in src.inputs())
            if (src.input(i).isAttached())
                outs.push(src.input(i).cable().start);
        var ins = this.attachedInputs(src.output());
        for (var i in src.inputs())
            this.detachPlug(src.input(i));
        for (var i in ins)
            this.detachPlug(ins[i]);
        // src node is now  fully detached, hopefully
        for (var i in outs)
            if (dst.input(i))
                this.connectPlugs(outs[i], dst.input(i));
        for (var i in ins)
            this.connectPlugs(dst.output(), ins[i]);
        dst.setViewing(src.isViewing());
        this._undostack.push(new DeleteNodeCommand(this, src));
        //this.unregisterNode(src);
        //this.deleteNode(src, false);
        this.scriptChanged("Replaced node: " + src.name + " with" + dst.name);
    },                     

    createNodeAtPoint: function(type, atpoint, context) {
        var self = this;                   
        var name = this.newNodeName(type);
        this._undostack.beginMacro("Create Node");
        this._undostack.push(
                new OCRJS.AddNodeCommand(this, name, type, atpoint));
        var node = this._usednames[name];

        if (context instanceof OCRJS.Nodetree.BasePlug) {
            var attachedplug = context;
            if (attachedplug.isOutput() && node.arity > 0)
                tree.connectPlugs(attachedplug, node.input(0));
            else
                tree.connectPlugs(node.output(), attachedplug);
        } else if (context && context instanceof OCRJS.Nodetree.Node) {
            tree.replaceNode(context, node);
            var pos = SvgHelper.getTranslate(context.group());
            node.moveTo(pos.x, pos.y);
            node.setFocussed(true);
        }

        // we need to attach the node to the mouse UNLESS it's replacing
        // another node
        if (context instanceof OCRJS.Nodetree.Node)
            return;


        var point = this.relativePoint(atpoint);
        node.moveTo(point.x - (node.width / 2), point.y - (node.height / 2));
        $(document).bind("keydown.dropnode", function(event) {
            if (event.which == KC_ESCAPE) {
                self._undostack.undo();
            } else if (event.which == KC_RETURN) {
                node.removeListeners("clicked.dropnode");
                $(self.parent).unbind(".dropnode");
                self.scriptChanged("Created node: " + node.name);
            }
        });
        $(this.parent).bind("mousemove.dropnode", function(event) {
            var nmp = SvgHelper.mouseCoord(self.parent, event);
            var npoint = self.relativePoint(nmp);
            node.moveTo(npoint.x - (node.width / 2), npoint.y - (node.height / 2));
        });
        node.addListener("clicked.dropnode", function() {
            node.removeListeners("clicked.dropnode");
            $(self.parent).unbind(".dropnode");
            self.scriptChanged("Created node: " + node.name);
        });

        this._undostack.endMacro();        
    },

    deleteNode: function(node, alert) {
        this.disconnectNode(node);
        node.removeNode(alert);
    },                    

    deleteSelected: function() {
        var self = this;                        
        // have to watch out we don't barf the _nodes index
        var togo = [];
        for (var i in this._nodes) {
            if (this._nodes[i].isFocussed())
                togo.push(this._nodes[i]);
        }
        var togo = $.map(this._nodes, function(n) {
            if (n.isFocussed()) return n;
        });
        var multi = togo.length > 1;
        this._undostack.beginMacro("Delete Selection");
        $.map(togo, function(n) {
            self.disconnectNode(n);
            self._undostack.push(new OCRJS.DeleteNodeCommand(self, n.name));
        });
        this._undostack.endMacro();
        this.scriptChanged("Deleted selected nodes");        
    },                        

    buildScript: function() {
        var script = {};                     
        $.each(this._nodes, function(i, n) {
            script[n.name] = n.serialize();
        });
        return script;
    },

    saveState: function() {
        this.base();
        var transform = $(this.group()).attr("transform");
        $.cookie("canvaspos", transform);
    },                   

    loadState: function() {
        //var transform = $.cookie("canvaspos");
        //if (transform) {
        //    $(this.group()).attr("transform", transform);
        //}
    },

    drawTree: function() {
        var self = this,
            svg = this.svg;

        this._group = svg.group(null, "canvas");
        this._cablegroup = svg.group(this._group, "cables");
        this.defineGradients();
    },

    connectNodes: function(treenodes) {
        var self = this;                      
        $.each(treenodes, function(name, node) {
            $.each(node.inputs, function(i, input) {
                console.log("Connecting:", input, name);
                var n1 = self._usednames[input];
                var n2 = self._usednames[name];
                self._connectPlugs(n1.output(), n2.input(i));
            });
        });    
    },                      

    layoutNodes: function() {
        var self = this;                
        $.ajax({            
            url: "/presets/layout_graph",
            type: "POST",
            data: {script: JSON.stringify(self.buildScript())},
            success: function(data) {
                $.each(data, function(node, value) {
                    self._usednames[node].moveTo(value[0], 
                            (self.svg._height() - value[1]) - 100);
                });
                self.centreTree();
            },
            error: OCRJS.ajaxErrorHandler,
        });
    },

    resetCanvas: function() {
        SvgHelper.updateTransform(this.group(), 0, 0, 1);
    },                     

    panContainer: function(event) {
        var dragstart = {
            x: event.pageX,
            y: event.pageY,
        };
        var self = this;
        var trans = SvgHelper.getTranslate(this.group());
        $(document).bind("mousemove.pancanvas", function(moveevent) {
            SvgHelper.updateTranslate(self.group(), 
                trans.x + (moveevent.pageX - dragstart.x),
                trans.y + (moveevent.pageY - dragstart.y)
            );
        });
        $(document).bind("mouseup.pancanvas", function() {
            $(this).unbind(".pancanvas");
            event.stopPropagation();
            event.preventDefault();
        });
    },

    keyZoom: function(factor) {
        var point = {
            x: $(this.parent).width() / 2,
            y: $(this.parent).height() / 2,
        };
        this.zoomAtPoint(point, factor);
    },                 

    mouseZoom: function(event, delta) {
        // ensure the point under the mouse stays under
        // the mouse when zooming.
        var point = SvgHelper.mouseCoord(this.parent, event);
        var factor = delta < 0 ? 0.75 : 1.5;
        this.zoomAtPoint(point, factor);
    },

    zoomAtPoint: function(point, factor) {                           
        var scale = SvgHelper.getScale(this.group());
        var trans = SvgHelper.getTranslate(this.group());
        var sx = scale * factor;
        if (sx < this._minzoom || sx > this._maxzoom)
            return false;

        var shiftx = (point.x - trans.x) * (1 - factor) + trans.x,
            shifty = (point.y - trans.y) * (1 - factor) + trans.y;
        SvgHelper.updateTransform(this.group(), shiftx, shifty, sx);
    },                   

    defineGradients: function() {                         
        var defs = this.svg.defs(this._group);
        this.svg.linearGradient(defs, "NodeGradient", 
            [["0%", "#f8f8f8"], ["100%", "#ebebeb"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "FocusGradient", 
            [["0%", "#f9fcf7"], ["100%", "#f5f9f0"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "ErrorGradient", 
            [["0%", "#fdedef"], ["100%", "#f9d9dc"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "ViewingGradient", 
            [["0%", "#a9cae5"], ["100%", "#6ea2cc"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "IgnoreGradient", 
            [["0%", "#ffffcf"], ["100%", "#ffffad"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "InPlugGradient", 
            [["0%", "#d8d8d8"], ["100%", "#dbdbdb"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "OutPlugGradient", 
            [["0%", "#dbdbdb"], ["100%", "#d8d8d8"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "PlugAccept", 
            [["0%", "#dbf0ca"], ["100%", "#d3e7c3"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "PlugReject", 
            [["0%", "#fdedef"], ["100%", "#f9d9dc"]], "0%", "0%", "0%", "100%");
        this.svg.linearGradient(defs, "PlugDragging", 
            [["0%", "#a9cae5"], ["100%", "#6ea2cc"]], "0%", "0%", "0%", "100%");
    },

    _connectPlugs: function(src, dst) {
        var self = this;
        console.log("_CONNECT PLUGS", src.name, dst.name);        
        var cable = new NT.Cable(src, dst);
        var p1 = SvgHelper.denorm(src.centre(), src.group(), this.group());
        var p2 = SvgHelper.denorm(dst.centre(), dst.group(), this.group());
        src.addListener("moved", function() {
            var m1 = SvgHelper.denorm(src.centre(), src.group(), self.group());
            var m2 = SvgHelper.denorm(dst.centre(), dst.group(), self.group());
            cable.update(m1, m2);            
        });
        dst.addListener("moved", function() {
            var m1 = SvgHelper.denorm(src.centre(), src.group(), self.group());
            var m2 = SvgHelper.denorm(dst.centre(), dst.group(), self.group());
            cable.update(m1, m2);            
        });
        cable.draw(this.svg, this._cablegroup, p1, p2);
    },                       
});
