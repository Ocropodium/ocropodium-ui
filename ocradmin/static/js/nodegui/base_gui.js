//
// GUI for crop node
//

function Rect(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    var self = this;
    this.area = function() {
        return self.w * self.h;
    }
}


var OCRJS = OCRJS || {};
OCRJS.NodeGui = OCRJS.NodeGui || {}

OCRJS.NodeGui.BaseGui = OCRJS.OcrBase.extend({
    constructor: function(viewer, id) {
        this.base();
        this.idgui = id;
        this._viewer = viewer;
        this._trackrects = [];
    },

    setupEvents: function() {
        var self = this;                     
        this._viewer.addListeners({
            resized: function() {
                self.resetSize();
            },
        });            
    },

    addTransformableRect: function(startpos, css, movedfunc) {
        var self = this;                              
        var rect = $("<div></div>")
            .addClass("nodegui_rect")
            .css(css);
        rect.bind("mousedown.rectclick", function(event) {
            self._viewer.activeViewer().setMouseNavEnabled(false);    
        }).bind("mouseup.rectclick", function(event) {
            self._viewer.activeViewer().setMouseNavEnabled(true); 
        })
        
        .resizable({
            handles: "all",
            resize: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                movedfunc.call(self, src);
            },
            stop: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                self._viewer.updateOverlayElement(rect.get(0),
                        [src.x0, src.y0, src.x1, src.y1]);
            },
        }).draggable({
            drag: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                movedfunc.call(self, src);
            },
            stop: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                self._viewer.updateOverlayElement(rect.get(0),
                        [src.x0, src.y0, src.x1, src.y1]);
            },
        });
        this._trackrects.push(rect);
        this._viewer.addOverlayElement(rect.get(0),
                [startpos.x0, startpos.y0, startpos.x1, startpos.y1]);
        return rect;
    },

    removeTransformableRect: function(element) {
        for (var i in this._trackrects)
            if (this._trackrects[i] == element)
                this._trackrects.splice(i, 1);
        this._viewer.removeOverlayElement(element.get(0));
        element.unbind(".rectclick").remove();
    },                                  

    resetSize: function() {
    },

    resetPosition: function() {
    },                       

    setup: function(node) {

    },

    tearDown: function() {

    },

    sourceDimensions: function() {
        return this._viewer.activeViewer().source.dimensions;
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
            y0: (y0 - fsrect.y)  / (zoom * factor),
            x1: (x1 - fsrect.x)  / (zoom * factor),
            y1: (y1 - fsrect.y)  / (zoom * factor)
        }; 
    },

    normalisedRect: function(x0, y0, x1, y1) {
        var sdx0 = this._viewer.activeViewer().viewport.pointFromPixel(
            new Seadragon.Point(x0 < x1 ? x0 : x1, y0 < y1 ? y0 : y1));
        var sdx1 = this._viewer.activeViewer().viewport.pointFromPixel(
            new Seadragon.Point(x1 > x0 ? x1 : x0, y1 > y0 ? y1 : y0));
        return new Seadragon.Rect(sdx0.x, sdx0.y, 
                sdx1.x - sdx0.x, sdx1.y - sdx0.y);
    },

    normalisedRectArea: function(x0, y0, x1, y1) {
        return Math.abs(x1 - x0) * Math.abs(y1 - y0);    
    }                
});

