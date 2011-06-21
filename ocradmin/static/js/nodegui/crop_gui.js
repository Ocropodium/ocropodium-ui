//
// GUI for crop node
//

var OCRJS = OCRJS || {};
OCRJS.NodeGui = OCRJS.NodeGui || {}

OCRJS.NodeGui.CropGui = OCRJS.NodeGui.BaseGui.extend({
    constructor: function(viewer) {
        this.base(viewer, "cropgui");

        this.nodeclass = "Pil::PilCrop";
        this._coords = {
            x0: -1,
            y0: -1,
            x1: -1,
            y1: -1,
        };
        this.registerListener("onCanvasChanged");
        this._node = null;

        this._color = "#FFBBBB";
        this._rect = $("<div></div>")
                .addClass("nodegui_rect").appendTo("body").css({
            borderColor: "red",
            borderWidth: 0,
            borderStyle: "solid",                    
            zIndex: 201,
            backgroundColor: this._color,
            opacity: 0.3,
        });
        this.makeRectTransformable(); 
    },

    readNodeData: function(node) {
        var coords = this._coords;                      
        $.each(node.parameters, function(i, param) {
            if (coords[param.name])
                coords[param.name] = parseInt(param.value);            
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
            x0: Math.max(-1, Math.min(coords.x0, fulldoc.x)),
            y0: Math.max(-1, Math.min(coords.y0, fulldoc.y)),
            x1: Math.max(-1, Math.min(coords.x1, fulldoc.x)),
            y1: Math.max(-1, Math.min(coords.y1, fulldoc.y)),
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
        var coords = this.sanitiseInputCoords(this.readNodeData(node));
        this._viewer.addOverlayElement(this._rect.get(0), 
                [coords.x0, coords.y0, coords.x1, coords.y1]);
        this.setupEvents();
    },

    tearDown: function() {
        this._viewer.activeViewer().drawer.removeOverlay(this._rect.get(0));                  
        this._rect.detach();
        this._canvas.detach();
        this._node = null;        
    },                  

    setupEvents: function() {
        var self = this;                     
        this.base();

        $(document).bind("keydown.togglecanvas", function(event) {
            if (event.which == KC_CTRL) {
                self._canvas.css({marginTop: 0});
                self.bindCanvasDrag(); 
            }
        });
        $(document).bind("keyup.togglecanvas", function(event) {
            self._canvas.css("marginTop", 0);
            if (event.which == KC_CTRL) {
                self._canvas.css({marginTop: 1000});
                self.unbindCanvasDrag(); 
            }
        });
        $(this._rect).bind("mousedown.rectclick", function(event) {
            self._viewer.activeViewer().setMouseNavEnabled(false);
        });
        $(this._rect).bind("mouseup.rectclick", function(event) {
            self._viewer.activeViewer().setMouseNavEnabled(true);
            var x0 = self._rect.position().left,
                y0 = self._rect.position().top,
                x1 = x0 + self._rect.width(),                        
                y1 = y0 + self._rect.height(),
                sdrect = self.normalisedRect(x0, y0, x1, y1);
            self._viewer.activeViewer().drawer.updateOverlay(self._rect.get(0), sdrect);
        }); 
    },

    bindCanvasDrag: function() {
        var self = this;                        
        this._canvas.bind("mousedown.drawcanvas", function(event) {
            var dragstart = {x: event.pageX, y: event.pageY };
            // initialise drawing
            var droprect = null;           
            self._canvas.bind("mousemove.drawcanvas", function(event) {
                var create = false;
                if (self.normalisedRectArea(dragstart.x, dragstart.y,
                        event.pageX, event.pageY) > 300) {
                    create = true;
                }
                if (create) {
                    var x0 = dragstart.x - self._canvas.offset().left,
                        y0 = dragstart.y - self._canvas.offset().top,
                        x1 = event.pageX - self._canvas.offset().left,                        
                        y1 = event.pageY - self._canvas.offset().top,
                        sdrect = self.normalisedRect(x0, y0, x1, y1);
                    self._viewer.activeViewer().drawer.updateOverlay(self._rect.get(0), sdrect);
                }
            });

            $(document).bind("mouseup.drawcanvas", function(event) {
                self.dragDone();                    
            });
        });
    },

    unbindCanvasDrag: function() {
        this._canvas.unbind("mousedown.drawcanvas");
        this._canvas.unbind("mousemove.drawcanvas");        
    },                          

    updateNodeParameters: function() {                                     
        var self = this;
        var pos = this._rect.offset();
        var src = this.getSourceRect(pos.left, pos.top, 
                pos.left + this._rect.width(), pos.top + this._rect.height());
        $.each(this.sanitiseOutputCoords(src), function(name, value) {
            self._node.setParameter(name, Math.round(value), true);
        });
    },                             

    dragDone: function() {
        $(document).unbind("mouseup.drawcanvas");
        this._canvas.unbind("mousemove.drawcanvas");
        this._canvas.unbind("mouseup.drawcanvas");
        this.updateNodeParameters();
        this.callListeners("onCanvasChanged");
    },              

    makeRectTransformable: function() {
        // add jQuery dragging/resize ability to
        // an overlay rectangle                            
        var self = this;
        this._rect.resizable({
            handles: "all",
            //containment: self._viewer.parent,
            stop: function() {
                self.updateNodeParameters();
                self.callListeners("onCanvasChanged");
            },
        })
        .draggable({
            //containment: self._viewer.parent,
            stop: function() {
                self.updateNodeParameters();
                self.callListeners("onCanvasChanged");
            },
            drag: function() {
                self.updateNodeParameters();
            },
        });
    },
});
