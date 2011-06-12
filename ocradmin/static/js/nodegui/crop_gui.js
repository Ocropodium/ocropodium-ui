//
// GUI for crop node
//

var OCRJS = OCRJS || {};
OCRJS.NodeGui = OCRJS.NodeGui || {}

OCRJS.NodeGui.CropGui = OCRJS.NodeGui.BaseGui.extend({
    constructor: function(viewer) {
        this.base(viewer, "cropgui");

        this.nodeclass = "Ocropus::Crop";
        this._coords = [];
        this._color = "#FFBBBB";
        this.registerListener("onCanvasChanged");
        this._handles = {x0: -1, y0: -1, x1: -1, y1: -1};
        this._node = null;
    },

    getData: function() {
        if (this._coords.length < 4)
            return { x0: -1, y0: -1,x1: -1,y1: -1 };    
        return {
            x0: this._coords[0],
            y0: this._coords[1],
            x1: this._coords[2],
            y1: this._coords[3],
        };
    },

    setup: function(node) {
        this._rect = document.createElement("div");
        this._node = node;
        $(this._rect).css({
            borderColor: this._color,
        });
        this._makeTransformable(this._rect); 
        this._hndl = new Seadragon.MouseTracker(this._rect);

        var sdrect = null; // TODO: Get rect of document!
        this._viewer.activeViewer().drawer.addOverlay(this._rect, sdrect);
    },

    tearDown: function() {
        this._viewer.drawer.removeOverlay(this._rect);                  
        $(this._rect).remove();
        this._node = null;        
    },                  

    setupEvents: function() {
        this.base();

        this._canvas.bind("mousedown.drawcanvas", function(event) {
            var dragstart = {x: event.pageX, y: event.pageY };
            // initialise drawing
            var droprect = null;           
            self._canvas.bind("mousemove.drawcanvas", function(event) {
                var create = false;
                if (self._normalisedRectArea(dragstart.x, dragstart.y,
                        event.pageX, event.pageY) > 300) {
                    self._initialiseNewDrag();
                    create = true;
                }

                if (create) {
                    var x0 = dragstart.x - self._canvas.offset().left,
                        y0 = dragstart.y - self._canvas.offset().top,
                        x1 = event.pageX - self._canvas.offset().left,                        
                        y1 = event.pageY - self._canvas.offset().top,
                        sdrect = self._normalisedRect(x0, y0, x1, y1);
                    self._viewer.activeViewer().drawer.updateOverlay(self._rect, sdrect);
                }
            });

            self._canvas.bind("mouseup.drawcanvas", function(event) {
                self.dragDone();                    
            });
        });

        this._hndl.pressHandler = function(tracker, pos, quick, shift) {
            self._viewer.activeViewer().setMouseNavEnabled(false);
        }
        this._hndl.clickHandler = function(tracker, pos, quick, shift) {
            //if (shift)
            //    self._deleteRect(tracker.target);
        }
        this._hndl.enterHandler = function(tracker, pos, btelem, btany) {
            //$(window).bind("keydown.setorder", function(event) {
            //    if (event.keyCode >= KC_ONE && event.keyCode <= KC_NINE)
            //        self._setRectOrder(
            //                tracker.target, event.keyCode - KC_ZERO);
            //});
        }
        this._hndl.exitHandler = function(tracker, pos, btelem, btany) {
            //$(window).unbind("keydown.setorder");
        }
        this._hndl.dragHandler = function(tracker, pos, delta, shift) {
        }

        this._hndl.releaseHandler = function(tracker, pos, insidepress, insiderelease) {
            self._viewer.activeViewer().setMouseNavEnabled(true);
            var ele = $(tracker.target),
                x0 = ele.position().left,
                y0 = ele.position().top,
                x1 = x0 + ele.width(),                        
                y1 = y0 + ele.height(),
                sdrect = self._normalisedRect(x0, y0, x1, y1);
            self._viewer.activeViewer().drawer.updateOverlay(tracker.target, sdrect);
        } 
    },

    getTranslatedRect: function() {
        var bufelem = this._viewer.activeViewer().elmt;
        var bufpos = Seadragon.Utils.getElementPosition(bufelem);
        var bufsize = Seadragon.Utils.getElementSize(bufelem);
        var bufrect = new Seadragon.Rect(0, 0, bufsize.x, bufsize.y);
        var srcsize = this._viewer.activeViewer().source.dimensions;

        var vp = this._viewer.activeViewer().viewport;
        var zoom = vp.getZoom();
        var adjust = bufsize.x / srcsize.x;
        var factor = zoom * adjust;

        var centre = vp.getCenter();
        var aspect = srcsize.x / srcsize.y;
        var zoomsize = srcsize.times(zoom * adjust);
        var zoomrect = new Seadragon.Rect(0, 0, zoomsize.x, zoomsize.y);
        var pointonzoomrectatcentre = new Seadragon.Point(
                zoomsize.x * centre.x, zoomsize.y * (centre.y * aspect));
        var bufcentre = bufrect.getCenter();
        var absrect = new Seadragon.Rect(bufcentre.x - pointonzoomrectatcentre.x,
                bufcentre.y - pointonzoomrectatcentre.y, zoomsize.x, zoomsize.y);
        var pos = $(this._rect).position();
        var x = Math.max(0, (pos.left - absrect.x) / factor),
            y = Math.max(0, (absrect.height - $(this._rect).height() - (pos.top - absrect.y)) / factor);
        var w = Math.min(srcsize.x, x + ($(this._rect).width() / factor)),
            h = Math.min(srcsize.y, y + ($(this._rect).height() / factor));
        return [x, y, x + w, y + h];
    },                  


    updateNodeParameters: function() {                                     
        console.assert(this._node, "No node found for GUI");

        var translatedrect = this.getTranslatedRect();
        // TODO:
    },                             

    dragDone: function() {
        this._hndl.setTracking(true);
        this._canvas.unbind("mousemove.drawcanvas");
        this._canvas.unbind("mouseup.drawcanvas");
        this.callListeners("onCanvasChanged");
    },              

    _initialiseNewDrag: function() {                
        var self = this;

    },

    _makeTransformable: function(elem) {
        // add jQuery dragging/resize ability to
        // an overlay rectangle                            
        var self = this;
        $(elem)
            .addClass("nodegui_rect")
            .resizable({
                handles: "all",
                stop: function() {
                    self.updateNodeParameters();
                    self.callListeners("onCanvasChanged");
                },
            })
            .draggable({
                stop: function() {
                    self.updateNodeParameters();
                    self.callListeners("onCanvasChanged");
                },
            });
    },
});
