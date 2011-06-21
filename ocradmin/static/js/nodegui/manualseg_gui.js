//
// GUI for crop node
//

var OCRJS = OCRJS || {};
OCRJS.NodeGui = OCRJS.NodeGui || {}

OCRJS.NodeGui.ManualSegGui = OCRJS.NodeGui.BaseGui.extend({
    constructor: function(viewer) {
        this.base(viewer, "manualseggui");

        this.nodeclass = "Ocrlab::SegmentPageManual";
        this._coords = [];
        this.registerListener("onCanvasChanged");
        this._node = null;

        this._colors = [
            ["#FFBBBB", "#FF8888"],
            ["#BBFFBB", "#88FF88"],
            ["#BBBBFF", "#8888FF"],
            ["#9966CC", "#9900CC"],
            ["#FFFF88", "#FFFF66"],
            ["#66BB00", "#339900"],
            ["#F7BE81", "#B45F04"],
            ["#D0A9F5", "#5F04B4"],
            ["#A9F5F2", "#088A85"],
        ];
        this._rects = [];
        this._css = {
            borderWidth: 1,
            borderStyle: "solid",                    
            zIndex: 201,
            opacity: 0.3,
        };
        this._paramre = /^\s*([-\d]+)\s*,\s*([-\d]+)\s*,\s*([-\d]+)\s*,\s*([-\d]+)\s*$/;
    },

    readNodeData: function(node) {
        var self = this;                      
        var coords = []; 
        $.each(node.parameters, function(i, param) {
            if (param.name == "boxes") {
                var coordarray = param.value.split("~");
                $.each(coordarray, function(n, coordstr) {
                    var match = coordstr.match(self._paramre);
                    if (match) {
                        coords.push({
                            x0: parseInt(RegExp.$1),
                            y0: parseInt(RegExp.$2),
                            x1: parseInt(RegExp.$3),
                            y1: parseInt(RegExp.$4),
                        });
                    } else {
                        console.error("Invalid box string:",  coordstr);
                    }
                });
            }
        });
        return coords;
    },                      

    sanitiseInputCoords: function(coords) {
        var fulldoc = this._viewer.activeViewer().source.dimensions;
        return {
            x0: Math.max(0, Math.min(fulldoc.x, coords.x0)),
            y0: Math.max(0, Math.min(fulldoc.y, coords.y0)),
            x1: (coords.x1 < 0 ? fulldoc.x : Math.min(fulldoc.x, coords.x1)),
            y1: (coords.y1 < 0 ? fulldoc.y : Math.min(fulldoc.y, coords.y1)),
        }
    },

    sanitiseOutputCoords: function(coords) {
        var fulldoc = this._viewer.activeViewer().source.dimensions;
        return {
            x0: Math.round(Math.max(-1, Math.min(coords.x0, fulldoc.x))),
            y0: Math.round(Math.max(-1, Math.min(coords.y0, fulldoc.y))),
            x1: Math.round(Math.max(-1, Math.min(coords.x1, fulldoc.x))),
            y1: Math.round(Math.max(-1, Math.min(coords.y1, fulldoc.y))),
        }
    },

    setup: function(node) {
        var self = this;
        console.assert(node, "Attempted GUI setup with null node");
        if (this._node)
            this.tearDown();

        this._node = node;
        this.resetSize();        
        this.resetPosition();        
        this._canvas.css({marginTop: 1000}).appendTo(this._viewer.parent);
        $.each(this.readNodeData(node), function(i, box) {
            var coords = self.sanitiseInputCoords(box);
            var elem = self.newColumnBox();
            self._viewer.addOverlayElement(elem.get(0), 
                    [coords.x0, coords.y0, coords.x1, coords.y1]);
        });
        //this.setupEvents();
    },

    tearDown: function() {
        this.removeRects();                  
        this._canvas.detach();
        this._node = null;
        $(document).unbind(".togglecanvas");        
    },

    removeRects: function() {
        console.log("Removing all boxes");                     
        for (var i in this._rects) {
            this._viewer.removeOverlayElement(this._rects[i].get(0));                  
            this._rects[i].remove();
        }
        this._rects = [];
    },                    

    setupEvents: function() {
        var self = this;                     
        this.base();

        $(document).bind("keydown.togglecanvas", function(event) {
            if (event.which == KC_CTRL) {
                self._canvas.css({marginTop: 0});
                self.bindCanvasDrag();
                console.log("Binding canvas drag");
                event.stopPropagation();
                event.preventDefault(); 
            }
        });
        $(document).bind("keyup.togglecanvas", function(event) {
            if (event.which == KC_CTRL) {
                self._canvas.css({marginTop: 1000});
                self.unbindCanvasDrag(); 
                console.log("UNBinding canvas drag"); 
                event.stopPropagation();
                event.preventDefault(); 
            }
        });
    },

    bindRectEvents: function(rect) {
        var self = this;                        
        rect.bind("mousedown.rectclick", function(event) {
            self._viewer.activeViewer().setMouseNavEnabled(false);
        });
        rect.bind("mouseup.rectclick", function(event) {
            self._viewer.activeViewer().setMouseNavEnabled(true);
            var roffset = rect.offset();
            var src = self.getSourceRect(roffset.left, roffset.top,
                    roffset.left + rect.width(), roffset.top + rect.height());
            self._viewer.updateOverlayElement(rect.get(0), 
                [src.x0, src.y0, src.x1, src.y1]);
        }); 
    },                        

    bindCanvasDrag: function() {
        var self = this;                        
        var coffset = this._canvas.offset();
        this._canvas.bind("mousedown.drawcanvas", function(event) {
            var dragstart = {
                x: event.pageX,
                y: event.pageY,
            };
            // initialise drawing
            var droprect = null;
            var create = false;           
            self._canvas.bind("mousemove.drawcanvas", function(event) {
                if (!create && !droprect && self.normalisedRectArea(dragstart.x, dragstart.y,
                        event.pageX, event.pageY) > 300) {
                    console.log("Creating new rect!", droprect);
                    droprect = self.newColumnBox();
                    create = true;
                }
                if (droprect) {
                    var func = create ? "addOverlay" : "updateOverlay";
                    var x0 = dragstart.x - coffset.left,
                        y0 = dragstart.y - coffset.top,
                        x1 = event.pageX - coffset.left,                        
                        y1 = event.pageY - coffset.top,
                        sdrect = self.normalisedRect(x0, y0, x1, y1);
                    self._viewer.activeViewer().drawer[func](droprect.get(0), sdrect);
                    create = false;
                }
            });

            $(document).bind("mouseup.drawcanvas", function(event) {
                self.dragDone();
            });
        });
    },

    newColumnBox: function() {
        var elem = $("<div></div>")
            .addClass("manualseg_column")
            .css(this._css).appendTo("body");                    
        var colorindex = this._rects.length;
        if (colorindex > this._colors.length - 1)
            colorindex = 0;
        elem.css({
            backgroundColor: this._colors[colorindex][0],
            borderColor: this._colors[colorindex][1],
        });
        this._rects.push(elem);
        this.bindRectEvents(elem);
        this.makeRectTransformable(elem);
        console.log("Adding new box");
        return elem;
    },                      

    unbindCanvasDrag: function() {
        this._canvas.unbind("mousedown.drawcanvas");
        this._canvas.unbind("mousemove.drawcanvas");        
    },                          

    updateNodeParameters: function() {                                     
        var self = this;        
        var rects = [];
        $.each(this._rects, function(i, rect) {
            var pos = rect.offset();
            var src = self.getSourceRect(pos.left, pos.top, 
                    pos.left + rect.width(), pos.top + rect.height());
            var out = self.sanitiseOutputCoords(src);
            rects.push([out.x0, out.y0, out.x1, out.y1].join(","));
        });
        this._node.setParameter("boxes", rects.join("~"), true);
    },                             

    dragDone: function() {
        var self = this;                  
        $(document).unbind("mouseup.drawcanvas");
        this._canvas.unbind("mousemove.drawcanvas");
        this._canvas.unbind("mouseup.drawcanvas");
        this.updateNodeParameters();
        this.callListeners("onCanvasChanged");
        setTimeout(function() {
            self._viewer.activeViewer().drawer.update();
        }, 20);
    },              

    makeRectTransformable: function(rect) {
        // add jQuery dragging/resize ability to
        // an overlay rectangle                            
        var self = this;
        rect.resizable({
            handles: "all",
            //containment: self._viewer.parent,
            stop: function() {
                self.updateNodeParameters();
                self.callListeners("onCanvasChanged");
                setTimeout(function() {
                    self._viewer.activeViewer().drawer.update();
                }, 50);
            },
        })
        .draggable({
            //containment: self._viewer.parent,
            stop: function() {
                self.updateNodeParameters();
                self.callListeners("onCanvasChanged");
                setTimeout(function() {
                    self._viewer.activeViewer().drawer.update();
                }, 50);
            },
            drag: function() {
                self.updateNodeParameters();
            },
        });
    },
});
