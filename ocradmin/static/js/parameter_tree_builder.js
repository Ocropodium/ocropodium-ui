//
// Fancy pants parameter tree.
//


var TESTTREE = [
    {
        "type": "Ocropus::FileIn", 
        "params": [
            [
                "path", 
                "etc/simple.png"
            ]
        ], 
        "name": "filein", 
        "inputs": []
    }, 
    {
        "type": "Ocropus::DeskewPageByRAST", 
        "params": [
            [
                "max_n", 
                10000
            ]
        ], 
        "name": "DeskewPageByRAST", 
        "inputs": [
            "BinarizeBySauvola"
        ]
    }, 
    {
        "type": "Ocropus::RmHalftone", 
        "params": [
            [
                "factor", 
                3
            ], 
            [
                "threshold", 
                4
            ]
        ], 
        "name": "RmHalftone", 
        "inputs": [
            "DeskewPageByRAST"
        ]
    }, 
    {
        "type": "Ocropus::BinarizeBySauvola", 
        "params": [
            [
                "k", 
                0.29999999999999999
            ], 
            [
                "w", 
                40
            ]
        ], 
        "name": "BinarizeBySauvola", 
        "inputs": [
            "filein"
        ]
    }, 
    {
        "params": [], 
        "type": "Cuneiform::CuneiformRecognizer", 
        "name": "NativeRecognizer", 
        "inputs": [
            "RmHalftone"
        ]
    }
]



var OCRJS = OCRJS || {}
var NT = OCRJS.Nodetree;

OCRJS.NodeTree = NT.Base.extend({
    constructor: function(parent, options) {
        this.base(parent, options);

        this.parent = parent;
        
        this._dragcable = null;
        this.svg = null;

        // we need to dynamically bind and unbind this event handler,
        // so keep a reference on 'self'
        var self = this;
        this._cableattachfunc = function(event) {
            self.setPlugSelect(event, event.target);
            event.preventDefault();
            event.stopPropagation();
        };

        this._usednames = {};
        this._nodedata = {};
        this._nodetypes = {};


    },


    init: function() {
        var self = this;
        console.log("Initialised...");

        self.queryOptions();
        
        $(self.parent).keydown(function(event) {
            console.log("keydown", event.which);
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
        });
    },

    removeDragCable: function() {
        if (this._dragcable) {
            this._dragcable.remove();
            this._dragcable = null;
        }
        $(document).unbind(".dragcable").unbind(".dropcable");
    },                        

    handlePlug: function(plug) {
        var self = this;                    
        if (!self._dragcable) {
            self.startCableDrag(plug);
        } else {
            self.connectPlugs(plug);
        }            
    },

    handlePlugHover: function(plug) {
        var self = this;
        if (self._dragcable) {
            var other = self._dragcable.plug;
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
        var point = self.denorm(plug.centre(), plug.group(), self.group());
        cable.draw(self.svg, self._cablegroup, point, point);
        self._dragcable = cable;
        $(document).bind("mousemove.dragcable", function(event) {
            var npoint = self.denorm(plug.centre(), plug.group(), self.group());
            var nmp = self.norm(self.mouseCoord(event), cable.group(), null);
            
            //var smp = self.divPoints(nmp, self.getScale(self.group()));
            //console.log(nmp.x, nmp.y, smp.x, smp.y);
            cable.update(npoint, self.divPoints(nmp, self.getScale(self.group())));
        }); 
        $(self.group()).bind("click.dropcable", function(event) {
            self.removeDragCable();
        });
    },

    connectPlugs: function(plug) {
        var self = this;                        
        var other = self._dragcable.plug;
        if (!other.wouldAccept(plug)) {
            self.removeDragCable();
            return;
        }
        var cable = new NT.Cable(other, plug);
        var p1 = self.denorm(other.centre(), other.group(), self.group());
        var p2 = self.denorm(plug.centre(), plug.group(), self.group());
        other.addListener("moved", function() {
            var m1 = self.denorm(other.centre(), other.group(), self.group());
            var m2 = self.denorm(plug.centre(), plug.group(), self.group());
            cable.update(m1, m2);
        });
        plug.addListener("moved", function() {
            var m1 = self.denorm(other.centre(), other.group(), self.group());
            var m2 = self.denorm(plug.centre(), plug.group(), self.group());
            cable.update(m1, m2);
        });
        cable.draw(self.svg, self._cablegroup, p1, p2);
        self.removeDragCable();    
    },                      

    setNodeErrored: function(nodename, error) {
        if (!this._usednames[nodename])
            throw "Unknown node name: " + nodename;
        this._usednames[nodename].setErrored(true, error);
    },                        

    scriptChange: function() {
        //this.runScript();
        //
        console.log("Script change");
    },

    buildParams: function(node) {
        console.log("Building params for ", node);
    },    

    queryOptions: function() {
        var self = this;
        var url = "/plugins/query/";
        $.ajax({
            url: url,
            type: "GET",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                $.each(data, function(i, nodeinfo) {
                    if (!self._nodedata[nodeinfo.stage])
                        self._nodedata[nodeinfo.stage] = [];
                    self._nodedata[nodeinfo.stage].push(nodeinfo);
                    self._nodetypes[nodeinfo.name] = nodeinfo;
                });

                $(self.parent).svg({                    
                    onLoad: function(svg) {
                        self.svg = svg;
                        self.drawTree(TESTTREE);
                    },
                });
            },
        });
    },

    drawTree: function(treenodes) {
        var self = this,
            svg = this.svg;

        var startx = 20,
            starty = 20;
        var topgroup = svg.group(null, "canvas");
        self._cablegroup = svg.group(topgroup, "cables");
        self._group = topgroup;
        var container = svg.rect(topgroup, 0, 0, svg._svg.clientWidth, svg._svg.clientHeight, {
            fill: "transparent",
            stroke: "transparent",    
        });
        $(topgroup).bind("mousedown", function(event) {
            if (event.button == 0) {
                self.panContainer(event, this);
            }
        });

        var defs = svg.defs(topgroup);
        svg.linearGradient(defs, "NodeGradient", 
            [["0%", "#f8f8f8"], ["100%", "#ebebeb"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "FocusGradient", 
            [["0%", "#f9fcf7"], ["100%", "#f5f9f0"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "ErrorGradient", 
            [["0%", "#fdedef"], ["100%", "#f9d9dc"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "ViewingGradient", 
            [["0%", "#a9cae5"], ["100%", "#6ea2cc"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "IgnoreGradient", 
            [["0%", "#ffffcf"], ["100%", "#ffffad"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "InPlugGradient", 
            [["0%", "#d8d8d8"], ["100%", "#dbdbdb"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "OutPlugGradient", 
            [["0%", "#dbdbdb"], ["100%", "#d8d8d8"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "PlugAccept", 
            [["0%", "#dbf0ca"], ["100%", "#d3e7c3"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "PlugReject", 
            [["0%", "#fdedef"], ["100%", "#f9d9dc"]], "0%", "0%", "0%", "100%");

        var rects = [],
            offx = 20,
            offy = starty;

        $.each(treenodes, function(i, node) {
            var typedata = self._nodetypes[node.type];            
            var nodeobj = new NT.Node(node.name, typedata, i);
            self._usednames[node.name] = nodeobj;
            self.setupNodeListeners(nodeobj);
            rects.push(nodeobj.buildElem(svg, topgroup, offx, offy));
            offy += 30 + 50;
        });

        $(topgroup).mousedown(function(event) {
            self.panContainer(event, this);
            event.preventDefault();
            event.stopPropagation();
        });

        $(topgroup).dblclick(function(event) {
            var sattr = $(this).attr("transform");
            var cx = 1.0, cy = 1.0;
            var match = false;
            if (sattr && sattr.match(self._scalere)) {
                cx = parseFloat(RegExp.$1);
                cy = parseFloat(RegExp.$2);
            }
            if (!event.shiftKey)
                cx *= 2, cy *= 2;
            else
                cx /= 2, cy /= 2;
            self.updateScale(this, cx, cy);
        });
    },

    panContainer: function(event, element, enlarge) {
        var dragstart = {
            x: event.pageX,
            y: event.pageY,
        };
        var self = this;
        var trans = self.getTranslate(element);
        var scale = self.getScale(element);
        $(document).bind("mousemove.dragelem", function(moveevent) {
            self.updateTranslate(element, 
                trans.x + ((moveevent.pageX - dragstart.x) / scale.x),
                trans.y + ((moveevent.pageY - dragstart.y) / scale.y));
        });
        $(document).bind("mouseup.unloaddrag", function() {
            $(this).unbind("mousemove.dragelem");
            $(this).unbind("mouseup.unloaddrag");
            var enlarge = $(element).children("rect");
            var trans = self.getTranslate(element);
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
        });
    },
});
