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

OCRJS.NodeTree = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(parent, options);

        this.parent = parent;
        
        this._dragcable = null;
        this.svg = null;
        this._parsetranslate = new RegExp('translate\\((-?\\d+)\\s*,\\s*(-?\\d+)\\)');
        this._translatere = /translate\(([-\d\.]+)\s*,\s*([-\d\.]+)\)/;
        this._scalere = /scale\(([-\d\.]+)\s*,\s*([-\d\.]+)\)/;

        // we need to dynamically bind and unbind this event handler,
        // so keep a reference on 'self'
        var self = this;
        this._cableattachfunc = function(event) {
            self.setPlugSelect(event, event.target);
            event.preventDefault();
            event.stopPropagation();
        };

    },


    init: function() {
        var self = this;
        console.log("Initialised...");

        
        $(this.parent).svg({
            onLoad: function(svg) {
                self.svg = svg;
                self.drawTree(TESTTREE);
            },
        });

        $(self.parent).keydown(function(event) {
            console.log("keydown", event.which);
        });
    },


    drawTree: function(treenodes) {
        var self = this,
            svg = this.svg;

        var startx = 20,
            starty = 20;
        var nodewidth = 150,
            nodeheight = 30,
            buttonwidth = 15;
        
        var topgroup = svg.group();
        self._topgroup = topgroup;
        var container = svg.rect(topgroup, 0, 0, svg._svg.clientWidth, svg._svg.clientHeight, {
            fill: "transparent",
            stroke: "transparent",    
        });
        $(topgroup).bind("mousedown", function(event) {
            if (event.button == 0) {
                self.setElementDragging(event, topgroup, container);
            }
        });

        $(topgroup).bind("keydown", function(event) {
            console.log("event", event.which);
        });

        var defs = svg.defs(topgroup);
        svg.linearGradient(defs, "NodeGradient", 
            [["0%", "#f8f8f8"], ["100%", "#ebebeb"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "ViewingGradient", 
            [["0%", "#a9cae5"], ["100%", "#6ea2cc"]], "0%", "0%", "0%", "100%");
        svg.linearGradient(defs, "IgnoreGradient", 
            [["0%", "#ffffcf"], ["100%", "#ffffad"]], "0%", "0%", "0%", "100%");

        var rects = [],
            viewbuttons = [],
            ignorebuttons = [],
            offy = starty,
            arity = 1;

        $.each(treenodes, function(i, node) {
            var g = svg.group(topgroup, "rect" + i);
            var x = startx, y = offy;
            // draw the plugs on each node.
            var plugx = nodewidth / (arity + 1);
            for (var p = 1; p <= arity; p++)
                svg.circle(g, x + (p*plugx), y - 1, 4, {
                        fill: "#999",
                        strokeWidth: 0.5,
                        id: "node" + i + "_input" + (p-1), 
                    }
                );

            // draw the bottom plug            
            svg.circle(g, x + nodewidth / 2,
                y + nodeheight + 1, 4, {
                    fill: "#999",
                    strokeWidth: 0.5,
                    id: "node" + i + "_output",
                }
            );

            // draw the rects themselves...
            svg.rect(g, x, y, nodewidth, nodeheight, 0, 0, {
                fill: "url(#NodeGradient)",
                stroke: "#BBB",
                strokeWidth: 1,
            });
            viewbuttons.push(svg.rect(g, x, y, buttonwidth, nodeheight, 0, 0, {
                fill: "transparent",
                stroke: "#BBB",
                strokeWidth: 0.5,
            }));         
            ignorebuttons.push(svg.rect(g, x + nodewidth - buttonwidth, y, buttonwidth, nodeheight, 0, 0, {
                fill: "transparent",
                stroke: "#BBB",
                strokeWidth: 0.5,
            }));         
            // add the labels
            svg.text(g, x + nodewidth / 2,
                y + nodeheight / 2, node.name, {
                    textAnchor: "middle",
                    alignmentBaseline: "middle",
                }
            );

            rects.push(g);   
            offy += nodeheight + 50;
        });

        $(rects).find("circle")
            .bind("click.attachcable", self._cableattachfunc)
            .hover(function(event) {
            self.svg.change(this, {fill: "#99F"});    
        }, function(event) {
            self.svg.change(this, {fill: "#999"});    
            
        });

        $(rects).mousedown(function(event) {
            self.setElementDragging(event, this);
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

        $(viewbuttons).click(function(event) {
            if ($(this).attr("fill") == "transparent")
                self.svg.change(this, {fill: "url(#ViewingGradient)"});
            else
                self.svg.change(this, {fill: "transparent"});
        });

        $(ignorebuttons).click(function(event) {
            if ($(this).attr("fill") == "transparent")
                self.svg.change(this, {fill: "url(#IgnoreGradient)"});
            else
                self.svg.change(this, {fill: "transparent"});
        });
    },


    updateScale: function(element, cx, cy) {
        var sstr = " scale("  + cx + "," + cy + ")";
        var sattr = $(element).attr("transform");
        if (sattr && sattr.match(this._scalere)) 
            $(element).attr("transform", $.trim(sattr.replace(this._scalere, sstr)));
        else if (sattr)
            $(element).attr("transform", $.trim(sattr + sstr));
        else
            $(element).attr("transform", $.trim(sstr)); 
    },

    updateTranslate: function(element, x, y) {
        var sstr = " translate("  + x + "," + y + ")";
        var sattr = $(element).attr("transform");
        if (sattr && sattr.match(this._translatere))
            $(element).attr("transform", $.trim(sattr.replace(this._translatere, sstr)));
        else if (sattr)
            $(element).attr("transform", $.trim(sattr + sstr));
        else
            $(element).attr("transform", $.trim(sstr)); 
    },

    mouseCoord: function(event) {
        var off = $(this.parent).offset();
        return {
            x: event.pageX - off.left,
            y: event.pageY - off.top,
        };
    },

    centrePointOfCircle: function(e) {
        return {
            x: parseInt($(e).attr("cx")),
            y: parseInt($(e).attr("cy")),
        };
    },

    createCablePathString: function(p1, p2) {
        return "M" + p1.x + " " + p1.y + " L" + p2.x + " " + p2.y + " Z";
    },

    getTranslate: function(element) {
        var trans = {x: 0, y: 0},
            tattr = $(element).attr("transform"),
            parse = tattr ? tattr.match(this._parsetranslate) : null;
        if (parse) {
            trans = {x: parseInt(RegExp.$1), y: parseInt(RegExp.$2)};
        }
        return trans;
    },

    getCablePath: function(sp, ep) {
        // get the cable arc between two points...                      
        var path = this.svg.createPath();
        var mp = {
            x: sp.x > ep.x ? sp.x + ((ep.x - sp.x) / 2) : ep.x + ((sp.x - ep.x) / 2),
            y: sp.y > ep.y ? sp.y + ((ep.y - sp.y) / 2) : ep.y + ((sp.y - ep.y) / 2),},
            radx = Math.abs(sp.x - ep.x),
            rady = Math.abs(sp.y - ep.y);
        return path.move(sp.x, sp.y)
                .arc(radx, rady, 0, false, sp.x > ep.x, mp.x, mp.y)
                .arc(radx, rady, 0, false, sp.x < ep.x, ep.x, ep.y);
    },

    norm: function(abs, element) {
        // get the position of the mouse relative to a 
        // transformed element.  FIXME: This is HORRIBLY
        // inefficient and stupid. 
        var parent = element.parentNode;
        var trans;
        while (parent.nodeName == "g") {
            trans = this.getTranslate(parent);
            abs.x -= trans.x;
            abs.y -= trans.y;
            parent = parent.parentNode;
        }
        return abs;
    },

    denorm: function(abs, element) {
        // get the position of the mouse relative to a 
        // transformed element.  FIXME: This is HORRIBLY
        // inefficient and stupid. 
        var parent = element.parentNode;
        var trans;
        while (parent.nodeName == "g") {
            trans = this.getTranslate(parent);
            abs.x += trans.x;
            abs.y += trans.y;
            parent = parent.parentNode;
        }
        return abs;
    },

    createCable: function(origin, element) {
        var self = this;             
        if ($(element).data("in"))
            self.svg.remove($(element).data("in"));        
        var sp = self.centrePointOfCircle(origin),                             
            ep = self.denorm(self.norm(self.centrePointOfCircle(element), origin), element);
        var cable = self.svg.path(origin.parentNode, self.getCablePath(sp, ep), {
            fill: "transparent", stroke: "#666", strokeWidth: 1,
        });

        var outs = $(origin).data("outs");
        if (!outs)
            outs = [cable];
        else
            outs.push(cable);
        $(origin).data("outs", outs);
        $(element).data("in", cable);
        $(cable).data({
            in: origin,
            out: element
        });
    },

    removeDragCable: function() {
        if (this._dragcable)                         
            this.svg.remove(this._dragcable);
        this._dragcable = null;
        $(document).unbind(".dragcable").unbind(".dropcable");
    },

    setPlugSelect: function(event, element) {                       
        var self = this;

        var sp = self.centrePointOfCircle(element),
            ep = self.norm(self.mouseCoord(event), element),
            finish = false;

        // if we've already got a dragging cable...
        if (self._dragcable) {
            if ($(self._dragcable).data("start") == element) {
                return;
            }
            var origin = $(self._dragcable).data("start");
            self.createCable(origin, element);
            self.removeDragCable();
            return;
        }


        self._dragcable = self.svg.path(element.parentNode, self.getCablePath(sp, ep),
            { fill: "transparent", stroke: "black", strokeWidth: 1,
                strokeDashArray: "2,2",
            });
        $(self._dragcable).data("start", element);

        $(document).bind("mousemove.dragcable", function(moveevent) {
            var np = self.norm(self.mouseCoord(moveevent), element);
            var path = self.getCablePath(sp, np);
            $(self._dragcable).attr("d", path.path());
            $(document).bind("click.dropcable", function() {
                self.removeDragCable();
            });
        });
    },

    updateCable: function(cable) {                     
        // update the cable position... N.B. The cable is
        // parented to it's input
        var self = this;
        var origin = $(cable).data("in"),
            element = $(cable).data("out");
        var sp = self.centrePointOfCircle(origin),                             
            ep = self.denorm(self.norm(self.centrePointOfCircle(element), origin), element);
        var path = self.getCablePath(sp, ep);
        $(cable).attr("d", path.path());
    },

    setElementDragging: function(event, element, enlarge) {
        var dragstart = {
            x: event.pageX,
            y: event.pageY,
        };
        var self = this;
        var trans = self.getTranslate(element);
        $(document).bind("mousemove.dragelem", function(moveevent) {
            self.updateTranslate(element, 
                trans.x + (moveevent.pageX - dragstart.x),
                trans.y + (moveevent.pageY - dragstart.y));
            $(element).children("circle").each(function(i, elem) {
                var outs = $(elem).data("outs");
                if (outs) {
                    $.each(outs, function(num, out) {
                        self.updateCable(out);    
                    });
                }
                var input = $(elem).data("in");
                if (input) {
                    self.updateCable(input);    
                }
            });

        });
        $(document).bind("mouseup.unloaddrag", function() {
            $(this).unbind("mousemove.dragelem");
            $(this).unbind("mouseup.unloaddrag");
            if (enlarge) {
                var trans = self.getTranslate(element);
                if (trans.x > 0) {
                    $(enlarge).attr("x", parseInt($(enlarge).attr("x")) - trans.x);
                    $(enlarge).attr("width", parseInt($(enlarge).attr("width")) + trans.x);
                } else
                    $(enlarge).attr("width", parseInt($(enlarge).attr("width")) - trans.x);
                if (trans.y > 0) {
                    $(enlarge).attr("y", parseInt($(enlarge).attr("y")) - trans.y);
                    $(enlarge).attr("height", parseInt($(enlarge).attr("height")) + trans.y);
                } else
                    $(enlarge).attr("height", parseInt($(enlarge).attr("height")) - trans.y);
            }
        });
    },
});
