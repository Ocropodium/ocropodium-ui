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
        this._color = "#FFBBBB";
        this.registerListener("onCanvasChanged");
        this._node = null;
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

        if (this._node)
            this.tearDown();

        this._node = node;
        this.resetSize();        
        this.resetPosition();        
        this._rect = $("<div></div>")
                .addClass("nodegui_rect").appendTo("body").css({
            borderColor: "red",
            borderWidth: 0,
            borderStyle: "solid",                    
            zIndex: 201,
            backgroundColor: this._color,
            opacity: 0.3,
        });
        this._canvas.css({marginTop: 1000}).appendTo(this._viewer.parent);
        this.makeRectTransformable(); 

        var coords = this.sanitiseInputCoords(this.readNodeData(node));
        var screen = this.getScreenRect(coords.x0, coords.y0, coords.x1, coords.y1);
        var vp = this.getViewportFromScreen(screen);
        var sdrect = this.sdRect(vp);
        setTimeout(function() {
            self._viewer.activeViewer().drawer.addOverlay(self._rect.get(0), sdrect);
        }, 200);
        this.setupEvents();
    },

    sdRect: function(pixelrect) {
        var sdx0 = this._viewer.activeViewer().viewport.pointFromPixel(pixelrect.getTopLeft());
        var sdx1 = this._viewer.activeViewer().viewport.pointFromPixel(pixelrect.getBottomRight());
        return new Seadragon.Rect(sdx0.x, sdx0.y, 
                sdx1.x - sdx0.x, sdx1.y - sdx0.y);
    },

    tearDown: function() {
        this._viewer.activeViewer().drawer.removeOverlay(this._rect.get(0));                  
        this._rect.remove();
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

    getFullDocumentRect: function() {
        var bufelem = this._viewer.activeViewer().elmt;
        var bufpos = Seadragon.Utils.getElementPosition(bufelem);
        var bufsize = Seadragon.Utils.getElementSize(bufelem);
        return new Seadragon.Rect(0, 0, bufsize.x, bufsize.y);
    },                             

    getExpandedRect: function() {
        /*
         * FIXME: I'm sure there's a much, much simpler way of doing this!
         *
         */
        var vp = this._viewer.activeViewer().viewport;
        var zoom = vp.getZoom();
        var centre = vp.getCenter();
        var srcdims = this._viewer.activeViewer().source.dimensions;
        var vpelement = $(this._viewer.activeViewer().drawer.elmt);
        var factor = vpelement.width() / srcdims.x;
        var midvp = new Seadragon.Rect(
                (vpelement.width() / 2) + vpelement.offset().left,
                (vpelement.height() / 2) + vpelement.offset().top);
        var fullsize = srcdims.times(zoom * factor);
        return new Seadragon.Rect(
            midvp.x - (fullsize.x * centre.x),
            midvp.y - (fullsize.y * (centre.y * (srcdims.x / srcdims.y))),
            fullsize.x,
            fullsize.y        
        );
    },                         

    getSourceRect: function(x0, y0, x1, y1) {
        // get coords from the screen and translate 
        // them to the source image                       
        var fsrect = this.getExpandedRect();
        var zoom  = this._viewer.activeViewer().viewport.getZoom();
        var srcdims = this._viewer.activeViewer().source.dimensions;
        var vpelement = $(this._viewer.activeViewer().drawer.elmt);
        var factor = vpelement.width() / srcdims.x;
        return {
            x0: (x0 - fsrect.x) / (zoom * factor),
            y0: ((fsrect.y + fsrect.height) - y0)  / (zoom * factor),
            x1: (x1 - fsrect.x)  / (zoom * factor),
            y1: ((fsrect.y + fsrect.height) - y1)  / (zoom * factor)
        }; 
    },

    getScreenRect: function(x0, y0, x1, y1) {
        // get coords from the source image and translate
        // them to the screen                       
        var fsrect = this.getExpandedRect();
        var zoom  = this._viewer.activeViewer().viewport.getZoom();
        var srcdims = this._viewer.activeViewer().source.dimensions;
        var vpelement = $(this._viewer.activeViewer().drawer.elmt);
        var factor = vpelement.width() / srcdims.x;
        var bottom = fsrect.y + fsrect.height;
        return new Seadragon.Rect(
            fsrect.x + (x0 * zoom * factor),
            bottom - (y1 * zoom * factor),
            (x1 - x0) * zoom * factor,
            (y1 - y0) * zoom * factor
        );
    },

    getViewportFromScreen: function(screen) {
        var vpoffset = $(this._viewer.activeViewer().drawer.elmt).offset();        
        return new Seadragon.Rect(
            screen.x - vpoffset.left,
            screen.y - vpoffset.top,
            screen.width,
            screen.height
        );
    },

    translateCoords: function(x0, y0, x1, y1) {
        var zoom  = this._viewer.activeViewer().viewport.getZoom();
        var srcdims = this._viewer.activeViewer().source.dimensions;
        var vpelement = $(this._viewer.activeViewer().drawer.elmt);
        var factor = vpelement.width() / srcdims.x;
        var srcheight = srcdims.y * zoom * factor;
        return {
            x0: x0,
            y0: srcheight - y1,
            x1: x1,
            y1: srcheight - y0,
        }
    },                         

    updateNodeParameters: function() {                                     
        var self = this;
        var pos = this._rect.offset();
        var src = this.getSourceRect(pos.left, pos.top + this._rect.height(), 
                pos.left + this._rect.width(), pos.top);
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
