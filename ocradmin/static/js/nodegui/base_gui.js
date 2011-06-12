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
    constructor: function(node, viewer) {
        this.base();

        this._idgui = id;
        this._node = node;
        this._viewer = viewer;
        this._shapes = [];
        this._canvas = $("<div></div>")
            .addClass("imageviewer_canvas")
            .attr("id", viewer.options.id + "_canvas");
        this.setupEvents();
    },

    setupEvents: function() {
        var self = this;                     
        this.viewer.addListeners({
            resized: function() {
                self.resetSize();
            },
        });            
    },                     

    resetSize: function() {
        this._canvas.height(this._viewer.height());
        this._canvas.width(this._viewer.width());
    },

    _normalisedRect: function(x0, y0, x1, y1) {
        var sdx0 = this._viewer.activeViewer().viewport.pointFromPixel(
            new Seadragon.Point(x0 < x1 ? x0 : x1, y0 < y1 ? y0 : y1));
        var sdx1 = this._viewer.activeViewer().viewport.pointFromPixel(
            new Seadragon.Point(x1 > x0 ? x1 : x0, y1 > y0 ? y1 : y0));
        return new Seadragon.Rect(sdx0.x, sdx0.y, 
                sdx1.x - sdx0.x, sdx1.y - sdx0.y);
    },


});

