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


var OcrJs = OcrJs || {};
OcrJs.NodeGui = OcrJs.NodeGui || {}

OcrJs.NodeGui.BaseGui = OcrJs.Base.extend({
    constructor: function(viewer, id) {
        this.base();
        this.idgui = id;
        this._viewer = viewer;
        this._trackrects = [];
        this._canvasdraggable = false;

        this._dragcss = {
            zIndex: 300,
            position: "absolute",
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: "#000",
        };

        this._listeners = {
            parameterSet: [],
            parametersSet: [],
            interactingStart: [],
            interactingStop: [], 
        };

    },

    setInteracting: function(bool) {
        this.trigger(bool ? "interactingStart" : "interactingStop");
    },                        

    setupEvents: function() {
        var self = this;                     
        this._viewer.addListeners({
            resized: function() {
                self.resetSize();
            },
        });

        if (this._canvasdraggable) {
            $(this._viewer.parent).bind("mousedown.viewdrag", function(event) {
                self.setInteracting(true);
                if (event.ctrlKey) {                    
                    self._viewer.activeViewer().setMouseNavEnabled(false);    
                    $(this).css("cursor", "crosshair");

                    var droprect = null;
                    var rect;
                    $(document).bind("mousemove.viewdrag", function(moveevent) {
                        rect = self.normalisedRect(event.pageX, event.pageY,
                                moveevent.pageX, moveevent.pageY);
                        if (!droprect && self.normalisedRectArea(event.pageX, event.pageY,
                                moveevent.pageX, moveevent.pageY) > 300) {
                            droprect = $("<div></div>")
                                .addClass("canvas_lasso")
                                .css(self._dragcss)
                                .css({
                                    left: rect.x0, top: rect.y0,
                                    width: rect.x1 - rect.x0, height: rect.y1 - rect.y0,
                                }).appendTo("body");
                        } 
                        if (droprect) {
                            droprect.css({
                                left: rect.x0, top: rect.y0,
                                width: rect.x1 - rect.x0, height: rect.y1 - rect.y0,
                            });
                        }
                    });
                    $(document).bind("mouseup.viewdrag", function(upevent) {
                        if (droprect) {
                            var off = droprect.offset();
                            var src = self.getSourceRect(off.left, off.top,
                                    off.left + droprect.width(), off.top + droprect.height());
                            self.draggedRect(src);
                            droprect.remove();
                        }
                        $(this)
                            .unbind("mousemove.viewdrag")
                            .unbind("mouseup.viewdrag");
                        $(self._viewer.parent).css("cursor", "auto");
                        self._viewer.activeViewer().setMouseNavEnabled(true);
                        self.setInteracting(false);
                    });
                }
            });
        }            
    },

    draggedRect: function(rect) {
        console.log("Dragged rect to position", rect.x0,
                rect.y0, rect.x1, rect.y1);
    },                     

    tearDownEvents: function() {
        $(this._viewer.parent).unbind(".viewdrag").unbind(".interact");
    },

    setCanvasDraggable: function() {
        this._canvasdraggable = true;
    },

    updateElement: function(element, src) {
        console.assert($.inArray(element, this._trackrects) != -1,
                        "Updating untracked element");                       
        this._viewer.updateOverlayElement(element.get(0),
                [src.x0, src.y0, src.x1, src.y1]);
    },                       

    addTransformableRect: function(startpos, css, movedfunc) {
        var self = this;                              
        var rect = $("<div></div>")
            .addClass("nodegui_rect")
            .css(css);
        rect.bind("mousedown.rectclick", function(event) {
            self._viewer.activeViewer().setMouseNavEnabled(false);
            self.setInteracting(true);    
            event.stopPropagation();
            event.preventDefault();

            rect.bind("mouseup.rectclick", function(event) {
                self._viewer.activeViewer().setMouseNavEnabled(true);
                self.setInteracting(false);    
                rect.unbind("mouseup.rectclick");
            });             
        })
        
        .resizable({
            handles: "all",
            resize: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                movedfunc.call(self, src);
            },
            start: function(event, ui) {
                self.setInteracting(true);
            },
            stop: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                self.updateElement(rect, src);
                self.setInteracting(false);
            },
        }).draggable({
            drag: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                movedfunc.call(self, src);
            },
            start: function(event, ui) {
                self.setInteracting(true);
            },
            stop: function(event, ui) {
                var off = $(this).offset();                      
                var src = self.getSourceRect(off.left, off.top,
                        off.left + $(this).width(), off.top + $(this).height());
                self.updateElement(rect, src);
                self.setInteracting(false);
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

    updateTransformableRect: function(element, rect) {
        this._viewer.updateOverlayElement($(element).get(0),
                [rect.x0, rect.y0, rect.x1, rect.y1]);
        $(element).trigger("resize");        
    },                                 

    resetSize: function() {
    },

    resetPosition: function() {
    },                       

    setup: function(node) {
        this.setupEvents();

    },

    update: function() {
        
    },                

    tearDown: function() {
        this.tearDownEvents();
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
        return {
            x0: Math.min(x0, x1),
            y0: Math.min(y0, y1),
            x1: Math.max(x0, x1),
            y1: Math.max(y0, y1),
        };
    },

    normalisedRectArea: function(x0, y0, x1, y1) {
        return Math.abs(x1 - x0) * Math.abs(y1 - y0);    
    }                
});

