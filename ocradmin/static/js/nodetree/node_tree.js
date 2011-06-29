//
// Fancy pants parameter tree.
//

var OCRJS = OCRJS || {}
var NT = OCRJS.Nodetree;
var SvgHelper = SvgHelper || new OCRJS.Nodetree.SvgHelper();

OCRJS.Nodetree.NodeTree = OCRJS.Nodetree.NodeList.extend({
    constructor: function(parent, options) {
        this.base(parent, options);

        this.parent = parent;
        this.svg = null;
        this._dragcable = null;
        this._nodes = [];
        this._usednames = {};
        this._nodedata = {};
        this._nodetypes = {};
        this._multiselect = false;
        this._menu = null;
        this._menucontext = null;
        this._menutemplate = $.template($("#nodeMenuTmpl"));
    },


    init: function() {
        this.queryNodeTypes();
    },

    resetSize: function() {                           
        var svg = $(this.parent).find("svg");
        svg
            .attr("width", Math.max($(this.parent).width(), svg.attr("width")))
            .attr("height", Math.max($(this.parent).height(), svg.attr("height")));
        this.syncDragTarget();
    },                   

    group: function() {
        return this._group;
    },        

    setupNodeListeners: function(node) {
        var self = this;                            
        node.addListeners({
            toggleIgnored: function(ig) {
                self.scriptChanged("Toggled ignored: " + node.name);
            },
            toggleFocussed: function() {
                if (!self._multiselect) {
                    $.each(self._nodes, function(i, other) {
                        if (node != other)
                            other.setFocussed(false);
                    });
                    self.buildParams(node);
                    self.callListeners("nodeFocussed", node);        
                }
            },
            toggleViewing: function(view) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != other.name)
                        other.setViewing(false);
                });
                self.scriptChanged("Toggled viewing: " + node.name);
            },
            moving: function() {
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
            dropped: function() {
                node.removeListeners("moved.dragmulti");
            },
            deleted: function() {
                console.log("Deleted node:", node.name);
                self.scriptChanged("Deleted: " + node.name);
            },
            clicked: function(event) {
                if (self._menucontext)
                    return self.hideContextMenu();                    
                if (event.shiftKey)
                    node.setFocussed(!node.isFocussed(), true);
                else
                    node.setFocussed(true, true);
            },
            rightClicked: function(event) {
                self._menucontext = node;
                self.showContextMenu(event);
            },
            inputAttached: function(plug) {
                console.log("Attached input to", node.name, plug.name);
                self.handlePlug(plug);
            },                               
            outputAttached: function(plug) {
                console.log("Attached output to", node.name, plug.name);
                self.handlePlug(plug);
            },
            plugHoverIn: function(plug) {
                self.handlePlugHover(plug);
            },
            plugRightClicked: function(plug, event) {
                self._menucontext = plug;
                self.showContextMenu(event);
            },                                  
        });
    },

    removeDragCable: function() {
        if (this._dragcable) {
            this._dragcable.start.setDefaultState();
            this._dragcable.remove();
            this._dragcable = null;
        }
        $(document).unbind(".dragcable").unbind(".dropcable");
    },                        

    handlePlug: function(plug) {
        var self = this;
        if (!self._dragcable && plug.isInput() && plug.isAttached()) {
            plug.detach();
            self.startCableDrag(plug);
        } else if (!self._dragcable) {
            self.startCableDrag(plug);
        } else {
            if (self._dragcable.start.wouldAccept(plug)) {
                if (plug.isInput() && plug.isAttached())
                    plug.detach();
                if (self._dragcable.start.isInput())
                    self.connectPlugs(plug, self._dragcable.start);
                else
                    self.connectPlugs(self._dragcable.start, plug);
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
        $(self.group()).bind("click.dropcable", function(event) {
            self.removeDragCable();
        });
    },

    connectPlugs: function(src, dst) {
        var self = this;                        
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
        cable.draw(self.svg, self._cablegroup, p1, p2);
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
            referencees[i].detach();                
        var input = node.input(0);
        if (!(input && input.isAttached()))
            return;
        var srcplug = input.cable().start;
        for (var i in referencees) {
            self.connectPlugs(srcplug, referencees[i]);
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
        $(self._group).noContext().rightClick(function(event) {
            self._menucontext = null;
            self.showContextMenu(event);
        });

        $(self._group).click(function(event) {
            if (!event.shiftKey)
                self.deselectAll();
        });

        function nodeCmd(event) {
            if (event.which == 61 || event.which == 45) {                    
                if (event.which == 61)
                    self.scaleContainer(1.5);                
                else
                    self.scaleContainer(0.75);
            }
        }
        $(self.parent).bind("mousewheel.zoomcanvas", function(event) {
            self.mouseZoom(event);
        });
        $(this._group).bind("mousedown", function(event) {
            if (event.button == 1 || event.button == 0 && event.shiftKey && event.ctrlKey) {
                self.panContainer(event);
            } else if (event.button == 0) {
                self.lassoSelect(event);    
            }                
        });

        //$(document).bind("keypress.nodecmd", nodeCmd);
        $(self.parent).bind("mouseenter", function(mvevent) {
            $(document).bind("keypress.nodecmd", function(event) {
                nodeCmd(event);
            });
            //$(document).bind("mousemove.debug", function(event) {
            //    self.debugMouseMove(event);
            //});
            $(document).bind("keydown.nodecmd", function(event) {
                if (event.which == KC_DELETE)
                    self.deleteSelected();
                else if (event.which == KC_SHIFT)
                   self._multiselect = true;
                else if (event.which == KC_HOME)
                    self.centreTree();
                else if (event.ctrlKey && event.which == 76) // 'L' key
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
        this.syncDragTarget();
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
            self.createNode($(this).data("name"), 
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
            var newnode = self.addNode(name, typedata);
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
        this.loadState();
    },                    

    addNode: function(name, typedata) {                         
        var id = $.map(this._usednames, function(){return true;}).length;
        var node = new NT.TreeNode(name, typedata, id);
        this.setupNodeListeners(node);
        this._usednames[name] = node;
        this._nodes.push(node);
        node.draw(this.svg, this._group, 0, 0);
        return node;
    },

    debugMouseMove: function(event) {
        var self = this;                        
        var pos = SvgHelper.mouseCoord(self.parent, event);
        var scale = SvgHelper.getScale(self.group());
        var mult = SvgHelper.multPoints(pos, scale);
        var div = SvgHelper.divPoints(pos, scale);
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
                        strokeWidth: 1 / scale.x, 
                        strokeDashArray: 2 / scale.x + "," + 2 / scale.x,
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
        return {x: (point.x - trans.x) / scale.x, y: (point.y - trans.y) / scale.y};
    },

    replaceNode: function(src, dst) {
        var outs = [];
        for (var i in src.inputs())
            if (src.input(i).isAttached())
                outs.push(src.input(i).cable().start);
        var ins = this.attachedInputs(src.output());
        for (var i in src.inputs())
            src.input(i).detach();
        for (var i in ins)
            ins[i].detach();
        // src node is now  fully detached, hopefully
        for (var i in outs)
            if (dst.input(i))
                this.connectPlugs(outs[i], dst.input(i));
        for (var i in ins)
            this.connectPlugs(dst.output(), ins[i]);
        dst.setViewing(src.isViewing());
        this.deleteNode(src, false);
        this.scriptChanged("Replaced node: " + src.name + " with" + dst.name);
    },                     

    createNode: function(type, atpoint, context) {
        var self = this;                   
        var name = self.newNodeName(type);
        var typedata = self._nodetypes[type];
        var nodeobj = self.addNode(name, typedata);
        var dragnode = true;
        // N.B. This uses a nasty hack to determine weather the context is
        // a node (to replace) or a plug (to wire).
        if (context && context.toString().search(/^<(In|Out)Plug/) > -1) {
            var attachedplug = context;
            if (attachedplug.isOutput() && nodeobj.arity > 0)
                self.connectPlugs(attachedplug, nodeobj.input(0));
            else
                self.connectPlugs(nodeobj.output(), attachedplug);
        } else if (context && context.toString().search(/^<Node/) > -1) {
            self.replaceNode(context, nodeobj);
            var pos = SvgHelper.getTranslate(context.group());
            nodeobj.moveTo(pos.x, pos.y);
            nodeobj.setFocussed(true);
            dragnode = false;
        }           

        if (!dragnode)
            return;

        var point = self.relativePoint(atpoint);
        nodeobj.moveTo(point.x - (nodeobj.width / 2), point.y - (nodeobj.height / 2));
        $(document).bind("keydown.dropnode", function(event) {
            if (event.which == KC_ESCAPE) {
                self.deleteNode(nodeobj);
            } else if (event.which == KC_RETURN) {
                nodeobj.removeListeners("clicked.dropnode");
                $(self._group).unbind(".dropnode");
                self.scriptChanged("Created node: " + nodeobj.name);
            }
        });
        $(self._group).bind("mousemove.dropnode", function(event) {
            var nmp = SvgHelper.mouseCoord(self.parent, event);
            var npoint = self.relativePoint(nmp);
            nodeobj.moveTo(npoint.x - (nodeobj.width / 2), npoint.y - (nodeobj.height / 2));
        });
        nodeobj.addListener("clicked.dropnode", function() {
            nodeobj.removeListeners("clicked.dropnode");
            $(self._group).unbind(".dropnode");
            self.scriptChanged("Created node: " + nodeobj.name);
        });        
    },

    deleteNode: function(node, alert) {
        var i = this._nodes.indexOf(node);
        console.assert(i > -1, "Node", node.name, "not found in self._nodes");
        delete this._usednames[node.name];
        this._nodes.splice(i, 1);
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
        $.map(togo, function(n) {self.deleteNode(n);});
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
        var transform = $.cookie("canvaspos");
        if (transform)
            $(this.group()).attr("transform", transform);
    },

    drawTree: function() {
        var self = this,
            svg = this.svg;

        this._group = svg.group(null, "canvas");
        this._cablegroup = svg.group(this._group, "cables");
        this._dragtarget = svg.rect(this._group, 0, 0, svg._width(), svg._height(), {
            fill: "transparent",
            fillOpacity: 0,
            stroke: "transparent",    
        });
        this.syncDragTarget();
        this.defineGradients();
    },

    connectNodes: function(treenodes) {
        var self = this;                      
        $.each(treenodes, function(name, node) {
            $.each(node.inputs, function(i, input) {
                console.log("Connecting:", input, name);
                var n1 = self._usednames[input];
                var n2 = self._usednames[name];
                self.connectPlugs(n1.output(), n2.input(i));
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
        SvgHelper.updateTransform(this.group(), 0, 0, 1, 1);
        this.syncDragTarget();
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
            self.syncDragTarget();
        });
    },

    mouseZoom: function(event) {
        // ensure the point under the mouse stays under
        // the mouse when zooming.  FIXME: This is a bit
        // skew-whiff....
        var self = this;         
        var scale = SvgHelper.getScale(this.group());
        var trans = SvgHelper.getTranslate(this.group());
        var point = SvgHelper.mouseCoord(this.parent, event);
        var cp = {
            x: (point.x - trans.x) * scale.x,
            y: (point.y - trans.y) * scale.y,
        };
        if (event.wheelDelta < 0)
            self.scaleContainer(0.8);
        else
            self.scaleContainer(1.25);
        var scaleb = SvgHelper.getScale(this.group());
        var cp2 = {
            x: (point.x - trans.x) * scaleb.x,
            y: (point.y - trans.y) * scaleb.y,
        };
        SvgHelper.updateTranslate(this.group(), trans.x + (cp.x - cp2.x),
                trans.y + (cp.y - cp2.y));
    },                   

    scaleContainer: function(by) {
        var scale = SvgHelper.getScale(this.group());
        var cx = scale.x, cy = scale.y;
        cx *= by, cy *= by;
        SvgHelper.updateScale(this.group(), cx, cy);
        this.syncDragTarget();
    },

    syncDragTarget: function() {
        var scale = SvgHelper.getScale(this.group());
        var trans = SvgHelper.getTranslate(this.group());
        var tx = $(this.parent).width(), ty = $(this.parent).height();
        $(this._dragtarget)
            .attr("width", tx / scale.x)
            .attr("height", ty / scale.y)
            .attr("x", -trans.x / scale.x)
            .attr("y", -trans.y / scale.y);
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
});
