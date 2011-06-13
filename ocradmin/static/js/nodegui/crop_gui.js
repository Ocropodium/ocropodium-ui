//
// GUI for crop node
//

var OCRJS = OCRJS || {};
OCRJS.NodeGui = OCRJS.NodeGui || {}

OCRJS.NodeGui.CropGui = OCRJS.NodeGui.BaseGui.extend({
    constructor: function(viewer) {
        this.base(viewer, "cropgui");

        this.nodeclass = "Ocropus::Crop";
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
        var self = this;                      
        $.each(node.parameters, function(i, param) {
            if (self._coords[param.name])
                self._coords[param.name] = parseInt(param.value);            
        });
    },                      

    sanitiseCoords: function() {
        var safe = {};
        var fulldoc = this._viewer.activeViewer().source.dimensions
        if (this._coords.x0 < 0)
            safe.x0 = 0;
        else
            safe.x0 = Math.min(fulldoc.x, this._coords.x0);

        if (this._coords.y0 < 0)
            safe.y0 = 0;
        else
            safe.y0 = Math.min(fulldoc.y, this._coords.y0);

        if (this._coords.x1 < 0)
            safe.x1 = fulldoc.x
        else
            safe.x1 = Math.min(fulldoc.x, this._coords.x1);

        if (this._coords.y1 < 0)
            safe.y1 = fulldoc.y;
        else
            safe.y1 = Math.min(fulldoc.y, this._coords.y1);
        return safe;
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
            borderWidth: 3,
            borderStyle: "solid",                    
            zIndex: 201,
            backgroundColor: this._color,
            opacity: 0.3,
        });

        this.readNodeData(node);
        this._canvas.css({marginTop: 1000}).appendTo(this._viewer.parent);
        this._makeRectTransformable(); 
        var coords = this.sanitiseCoords();
        console.log("Coords points", coords.x0, coords.y0, coords.x1, coords.y1);
        var screen = this.getScreenRect(coords.x0, coords.y0, coords.x1, coords.y1);
        console.log("Screen points", screen.x0, screen.y0, screen.x1, screen.y1);
        var vp = this.getViewportFromScreen(screen.x0, screen.y0, screen.x1, screen.y1); 
        var sdrect = this.normalisedRect(vp.x0, vp.y0, vp.x1, vp.y1);
        setTimeout(function() {
            self._viewer.activeViewer().drawer.addOverlay(self._rect.get(0), sdrect);
        }, 200);
        this.setupEvents();
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
            console.log("Dragging canvas");
            var dragstart = {x: event.pageX, y: event.pageY };
            // initialise drawing
            var droprect = null;           
            self._canvas.bind("mousemove.drawcanvas", function(event) {
                console.log("Drawing canvas");
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
        var fullsize = srcdims.times(zoom);
        return new Seadragon.Rect(
            midvp.x - (fullsize.x * centre.x * factor),
            midvp.y - (fullsize.y * (centre.y * factor * (srcdims.x / srcdims.y))),
            fullsize.x,
            fullsize.y        
        );
    },                         

    getSourceRect: function(x0, y0, x1, y1) {
        // get coords from the screen and translate 
        // them to the source image                       
        var fsrect = this.getExpandedRect();
        return {
            x0: x0 - fsrect.x,
            y0: (fsrect.y + fsrect.height) - y0,
            x1: x1 - fsrect.x,
            y1: (fsrect.y + fsrect.height) - y1
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
        return {
            x0: fsrect.x + (x0 * zoom * factor),
            y0: fsrect.y + (y0 * zoom * factor),
            x1: fsrect.x + (x1 * zoom * factor),
            y1: fsrect.y + (y1 * zoom * factor),
        }; 
    },

    getViewportFromScreen: function(x0, y0, x1, y1) {
        var vpoffset = $(this._viewer.activeViewer().drawer.elmt).offset();
        return {
            x0: x0 - vpoffset.left,
            y0: y0 - vpoffset.top,
            x1: x1 - vpoffset.left,
            y1: y1 - vpoffset.top,            
        };
    },                               

    updateNodeParameters: function() {                                     
        //console.assert(this._node, "No node found for GUI");
        console.log("Screen", this._rect.offset().left,
                this._rect.offset().top,
                this._rect.width() - this._rect.offset().left,
                this._rect.height() - this._rect.offset().top);
        var pos = this._rect.offset();
        var src = this.getSourceRect(pos.left, pos.top + this._rect.height(), 
                pos.left + this._rect.width(), pos.top);


        console.log("Src", src.x0, src.y0, src.x1, src.y1);
    },                             

    dragDone: function() {
        $(document).unbind("mouseup.drawcanvas");
        this._canvas.unbind("mousemove.drawcanvas");
        this._canvas.unbind("mouseup.drawcanvas");
        this.callListeners("onCanvasChanged");
    },              

    _makeRectTransformable: function() {
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
        });
    },
});
