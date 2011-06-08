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

    group: function() {
        return this._group;
    },        

    setupNodeListeners: function(node) {
        var self = this;                            
        node.addListeners({
            toggleIgnored: function(ig) {
                self.scriptChange();
            },
            toggleFocussed: function() {
                self.hideContextMenu();                                
                if (!self._multiselect) {
                    $.each(self._nodes, function(i, other) {
                        if (node != other)
                            other.setFocussed(false);
                    });
                    self.buildParams(node);
                }
            },
            toggleViewing: function(view) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != other.name)
                        other.setViewing(false);
                });
                self.scriptChange();
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
                self.scriptChange();
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
            cable.update(npoint, self.relativePoint(nmp, cable.group()));
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

        $("#optionsform").submit(function(event) {
            self.runScript();
            event.preventDefault();
            event.stopPropagation();
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
            if (event.wheelDelta < 0)
                self.scaleContainer(0.9);
            else
                self.scaleContainer(1.1);
        });
        $(this._group).bind("mousedown", function(event) {
            if (event.button == 1 || event.button == 0 && event.shiftKey && event.ctrlKey) {
                self.panContainer(event, this);
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

    deselectAll: function() {
        $.map(this._nodes, function(n) {
            n.setFocussed(false);
        });
    },

    selectAll: function() {
        $.map(this._nodes, function(n) {
            n.setFocussed(true);
        });
    },    

    setupMenuEvents: function() {
        var self = this;                         
        self._menu.find("li").hover(function(event) {
            $(this).addClass("selected");
        }, function(event) {
            $(this).removeClass("selected");
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
        var left = event.clientX;
        if (event.clientX + this._menu.outerWidth() > maxx)
            left = maxx - (this._menu.outerWidth() + 20);
        this._menu.css({
            top: event.clientY,
            left: left,    
        });
        $(this._group).bind("click.menuhide", function(event) {
            self.hideContextMenu();            
            $(self._group).unbind("click.menuhide");
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
        self._menu = $.tmpl(this._menutemplate, {
            stages: self._nodedata,
        }).hide();
        $(self.parent).append(self._menu);
        self.setupMenuEvents();
    },    

    populateCanvas: function() {
        var self = this;                        
        $(this.parent).svg({                    
            onLoad: function(svg) {
                self.svg = svg;
                self.drawTree();
                self.loadState();
                self.setupEvents();
                self.buildNodeMenu();
            },
        });
    },

    loadScript: function(script) {
        var self = this;
        if (script.length < 1)
            return;
        var havemeta = false;
        $.each(script, function(i, node) {
            var typedata = self._nodetypes[node.type];
            var newnode = self.addNode(node.name, typedata);
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
        if (script.length > 0)
            if (!havemeta)
                this.layoutNodes(script);
        this.scriptChange();
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
        console.log("Raw pos:", pos.x, pos.y, "Scale:", scale.x, scale.y);
        var mult = SvgHelper.multPoints(pos, scale);
        var div = SvgHelper.divPoints(pos, scale);
        console.log("Mult:", mult.x, mult.y, "Div:", div.x, div.y);
    },

    lassoSelect: function(event) {                             
        var self = this;
        var scale = SvgHelper.getScale(self.group());        
        var start = self.relativePoint(
                SvgHelper.mouseCoord(self.parent, event), self._cablegroup);
        var lasso = null;
        $(document).bind("mousemove.lasso", function(mevent) {
            var end = self.relativePoint(
                    SvgHelper.mouseCoord(self.parent, mevent), self._cablegroup);
            var rect = SvgHelper.rectFromPoints(start, end);
            if (!lasso && Math.sqrt(rect.width^2 + rect.height^2) > 5) {
                lasso = self.svg.rect(self.group(), rect.x, rect.y, 
                            rect.width, rect.height, 0, 0, {
                        fill: "transparent",
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
        // FIXME: Hard-coded node width/height;                    
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

    relativePoint: function(point, to) {
        var mp = SvgHelper.norm(point, to, null);
        return SvgHelper.divPoints(mp, SvgHelper.getScale(this.group()));
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
        this.scriptChange();
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

        var point = self.relativePoint(atpoint, nodeobj.group());
        nodeobj.moveTo(point.x - (nodeobj.width / 2), point.y - (nodeobj.height / 2));
        $(document).bind("keydown.dropnode", function(event) {
            if (event.which == KC_ESCAPE)
                nodeobj.remove();
        });
        $(self._group).bind("mousemove.dropnode", function(event) {
            var nmp = SvgHelper.mouseCoord(self.parent, event);
            var npoint = self.relativePoint(nmp, nodeobj.group());
            nodeobj.moveTo(npoint.x - (nodeobj.width / 2), npoint.y - (nodeobj.height / 2));
            $(document).add($(nodeobj.group()).find("*")).bind("click.dropnode", function(e) {
                $(self._group).unbind(".dropnode");
                $(document).add($(nodeobj.group()).find("*")).unbind(".dropnode");
            });
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
        $.each(this._nodes, function(i, node) {
            if (node.isFocussed())
                console.log("    ", node.name);    
        });
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
        this.scriptChange();        
    },                        

    buildScript: function() {
        return $.map(this._nodes, function(n) {
            return n.serialize();
        });
    },                     

    drawTree: function() {
        var self = this,
            svg = this.svg;

        this._group = svg.group(null, "canvas");
        this.defineGradients();
        self._cablegroup = svg.group(this._group, "cables");
        var container = svg.rect(this._group, 0, 0, svg._width(), svg._height(), {
            fill: "transparent",
            fillOpacity: 0,
            stroke: "transparent",    
        });
    },

    connectNodes: function(treenodes) {
        var self = this;                      
        $.each(treenodes, function(ni, node) {
            $.each(node.inputs, function(i, input) {
                var n1 = self._usednames[input];
                var n2 = self._usednames[node.name];
                self.connectPlugs(n1.output(), n2.input(i));
            });
        });    
    },                      

    layoutNodes: function(script) {
        var self = this;                
        $.ajax({            
            url: "/plugins/layout_graph",
            type: "POST",
            data: {script: JSON.stringify(script)},
            success: function(data) {
                $.each(data, function(node, value) {
                    self._usednames[node].moveTo(value[0], 
                            (self.svg._height() - value[1]) - 100);
                });
            },
            error: OCRJS.ajaxErrorHandler,
        });
    },                

    panContainer: function(event, element) {
        var dragstart = {
            x: event.pageX,
            y: event.pageY,
        };
        var self = this;
        var trans = SvgHelper.getTranslate(element);
        var scale = SvgHelper.getScale(element);
        $(document).bind("mousemove.pancanvas", function(moveevent) {
            SvgHelper.updateTranslate(element, 
                trans.x + ((moveevent.pageX - dragstart.x) / scale.x),
                trans.y + ((moveevent.pageY - dragstart.y) / scale.y));
        });
        $(document).bind("mouseup.pancanvas", function() {
            $(this).unbind(".pancanvas");
            var enlarge = $(element).children("rect");
            var trans = SvgHelper.getTranslate(element);
            if (trans.x > 0) {
                enlarge.attr("x", parseInt(enlarge.attr("x")) - trans.x);
                enlarge.attr("width", parseInt(enlarge.attr("width")) + trans.x);
            } else
                enlarge.attr("width", parseInt(enlarge.attr("width")) - trans.x);
            if (trans.y > 0) {
                enlarge.attr("y", parseInt(enlarge.attr("y")) - trans.y);
                enlarge.attr("height", parseInt(enlarge.attr("height")) + trans.y);
            } else
                enlarge.attr("height", parseInt(enlarge.attr("height")) - trans.y);
            event.stopPropagation();
            event.preventDefault();
        });
    },

    scaleContainer: function(by) {
        var scale = SvgHelper.getScale(this.group());
        var cx = scale.x, cy = scale.y;
        cx *= by, cy *= by;
        SvgHelper.updateScale(this.group(), cx, cy);
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
