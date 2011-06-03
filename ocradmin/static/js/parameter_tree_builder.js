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
        
        this._dragstart = null;
        this._elemstart = null;

    },


    init: function() {
        var self = this;
        console.log("Initialised...");

        
        $(this.parent).svg({
            onLoad: function(svg) {
                self.drawTree(TESTTREE, svg);
            },
        });
    },


    drawTree: function(treenodes, svg) {
        var self = this;

        var startx = 20,
            starty = 20;
        var nodewidth = 150,
            nodeheight = 30;
        
        var g = svg.group(); 
        var defs = svg.defs(g);
        svg.linearGradient(
            defs,
            "NodeGradient", 
            [["0%", "#f8f8f8"], ["100%", "#ebebeb"]],
            "0%", "0%", "0%", "100%"
        );

        var rects = [],
            offy = starty,
            arity = 2;

        $.each(treenodes, function(i, node) {
            var g = svg.group("rect" + i);
            svg.rect(g, startx, offy, nodewidth, nodeheight, 0, 0, {
                fill: "url(#NodeGradient)",
                stroke: "#BBB",
                strokeWidth: 1,
            });         
            rects.push(g);   
            offy += nodeheight + 20;
        });

        // draw the plugs on each node.
        $.each(treenodes, function(i, node) {
            var rect = $(rects[i]).find("rect");
            console.log(rect);
            var plugx = nodewidth / (arity + 1);

            // draw input plugs...
            for (var p = 1; p <= arity; p++)
                svg.circle(
                    rects[i],                     
                    parseInt(rect.attr("x")) + (p*plugx),
                    rect.attr("y"),
                    3,
                    {
                        fill: "#999",
                        strokeWidth: 0.5,
                        id: "node" + i + "_input" + (p-1), 
                    }
                );

            // draw the bottom plug            
            svg.circle(
                rects[i],
                parseInt(rect.attr("x")) + (nodewidth / 2),
                parseInt(rect.attr("y")) + nodeheight,
                3,
                {
                    fill: "#999",
                    strokeWidth: 0.5,
                    id: "node" + i + "_output",
                }
            );
        });

        $(rects).find("circle").click(function(event) {
            self.setPlugSelect(svg, event, this);
        });

        $(rects).mousedown(function(event) {
            self.setElementDragging(event, this);
        });
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
            x: parseInt($(e).attr("cx")) + parseInt($(e).attr("r")) / 2,
            y: parseInt($(e).attr("cy")) + parseInt($(e).attr("r")) / 2,
        };
    },

    createCablePathString: function(p1, p2) {
        return "M" + p1.x + " " + p1.y + " L" + p2.x + " " + p2.y + " Z";
    },

    setPlugSelect: function(svg, event, element) {
        var self = this,
            mp = self.mouseCoord(event)
            ep = self.centrePointOfCircle(element);
        self._dragcable = svg.path(null, self.createCablePathString(ep, mp),
            { fill: "transparent", stroke: "black", strokeWidth: 1, style: {
                strokeDashArray: [9, 5],
            }});

        $(document).bind("mousemove.dragcable", function(moveevent) {
            var np = self.mouseCoord(moveevent);
            $(self._dragcable).attr("d", 
                self.createCablePathString(ep, np));
            $(document).bind("mousedown.dropcable", function() {
                $(this)
                    .unbind("mousemove.dragcable")
                    .unbind("mousedown.dropcable");                
            });
        });
    },
    

    setElementDragging: function(event, element) {
        this._dragstart = {
            x: event.pageX,
            y: event.pageY,
        };
        var self = this;
        $(document).bind("mousemove.dragelem", function(moveevent) {
            $(element).attr({
                transform: "translate(" 
                    + (moveevent.pageX - self._dragstart.x)
                    + ","
                    + (moveevent.pageY - self._dragstart.y)
                    + ")",
            });
        });
        $(document).bind("mouseup.unloaddrag", function() {
            $(this).unbind("mousemove.dragelem");
            $(this).unbind("mouseup.unloaddrag");
            self._dragstart = null;
        });
    },
});
