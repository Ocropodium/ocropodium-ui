// 
// DziViewer plugin base classes
//


function NotImplementedError() {
    Error.apply(this, arguments);
}

NotImplementedError.prototype = new Error();
NotImplementedError.prototype.constructor = NotImplementedError;
NotImplementedError.prototype.name = "NotImplemented";

// function from:
// http://vetruvet.blogspot.com/2010/10/drawing-dashed-lines-on-html5-canvas.html
//
CanvasRenderingContext2D.prototype.dashedLine = function(x1, y1, x2, y2, dashLen) {
    if (dashLen == undefined) dashLen = 2;
    
    this.beginPath();
    this.moveTo(x1, y1);
    
    var dX = x2 - x1;
    var dY = y2 - y1;
    var dashes = Math.floor(Math.sqrt(dX * dX + dY * dY) / dashLen);
    var dashX = dX / dashes;
    var dashY = dY / dashes;
    
    var q = 0;
    while (q++ < dashes) {
     x1 += dashX;
     y1 += dashY;
     this[q % 2 == 0 ? 'moveTo' : 'lineTo'](x1, y1);
    }
    this[q % 2 == 0 ? 'moveTo' : 'lineTo'](x2, y2);
    
    this.stroke();
    this.closePath();
};

CanvasRenderingContext2D.prototype.dashedRect = function(x, y, width, height, dashLen) {
    this.dashedLine(x, y, x + width, y, dashLen);
    this.dashedLine(x + width, y, x + width, y + height, dashLen);
    this.dashedLine(x + width, y + height, x, y + height, dashLen);
    this.dashedLine(x, y + height, x, y, dashLen);
};    




var DziViewer = DziViewer || {};
DziViewer.Plugin = DziViewer.Plugin || {};

DziViewer.Plugin.Base = OcrJs.Base.extend({


    init: function(viewport) {
        
        this.viewport = viewport;

        this._listeners = {
            update: [],
            interactingStart: [],
            interactingStop: [],
        };
    },

    render: function(context) {
        throw new NotImplementedError("render");
    },

    handleEvent: function() {
        throw new NotImplementedError("handleEvent");
    },

    handleEvent: function(name, event) {
        switch (name) {
            case "mousedown": 
                return this.handleClick(event);
            case "mousemove":
                return this.handleMove(event);
            case "keydown":
                return this.handleKeyDown(event);
            default:
                return false;
        }    
    },

    handleClick: function(event) {
        throw new NotImplementedError("handleClick");
    },

    handleWheel: function(event, delta) {
        throw new NotImplementedError("handleWheel");
    },

    handleKeyDown: function(event) {
        throw new NotImplementedError("keyDown");
    },                       

    handleMove: function(event) {
        throw new NotImplementedError("handleMove");
    },

    update: function() {
        this.trigger("update");
    },                
});


DziViewer.Plugin.RectManager = DziViewer.Plugin.Base.extend({
    init: function(viewport) {
        this._super(viewport);

        this._current = null;
    },              

    // sensitivity to edges
    DISTANCE: 5,
    MINSIZE: 100,

    // 
    NOEDGE: 0,
    TOPLEFT: 1,
    TOP: 2,
    TOPRIGHT: 3,
    RIGHT: 4,
    BOTTOMRIGHT: 5,
    BOTTOM: 6,
    BOTTOMLEFT: 7,
    LEFT: 8,

    hitsEdge: function(rect, cpoint) {
        var over = Math.max(this.DISTANCE, this.DISTANCE * this.viewport.scale);
        if (Math.abs(cpoint.x - rect.x0) <= over * 3 && Math.abs(cpoint.y - rect.y0) <= over * 3)
            return this.TOPLEFT;
        else if (Math.abs(cpoint.x - rect.x1) <= over * 3 && Math.abs(cpoint.y - rect.y0) <= over * 3)
            return this.TOPRIGHT;
        else if (Math.abs(cpoint.x - rect.x1) <= over * 3 && Math.abs(cpoint.y - rect.y1) <= over * 3)
            return this.BOTTOMRIGHT;
        else if (Math.abs(cpoint.x - rect.x0) <= over * 3 && Math.abs(cpoint.y - rect.y1) <= over * 3)
            return this.BOTTOMLEFT;
        else if (Math.abs(cpoint.x - rect.x0) < over)
            return this.LEFT;
        else if (Math.abs(cpoint.x - rect.x1) < over)
            return this.RIGHT;
        else if (Math.abs(cpoint.y - rect.y0) < over)
            return this.TOP;
        else if (Math.abs(cpoint.y - rect.y1) < over)
            return this.BOTTOM;
        return this.NOEDGE;
    },

    handleMove: function(event) {
        var point = this.viewport.getContentPosition(
                new DziViewer.Point(event.pageX, event.pageY));
        var cursor = "auto";
        this._current = null;
        for (var i in this._rects) {
            var edge = this.hitsEdge(this._rects[i], point);
            if (edge != this.NOEDGE || this._rects[i].contains(point)) {
                this._current = this._rects[i];
                switch(edge) {
                    case this.TOPLEFT:
                        cursor = "nw-resize";
                        break;
                    case this.TOP:
                        cursor = "n-resize";
                        break;
                    case this.TOPRIGHT:
                        cursor = "ne-resize";
                        break;
                    case this.RIGHT:
                        cursor = "e-resize";
                        break;
                    case this.BOTTOMRIGHT:
                        cursor = "se-resize";
                        break;
                    case this.BOTTOM:
                        cursor = "s-resize";
                        break;
                    case this.BOTTOMLEFT:
                        cursor = "sw-resize";
                        break
                    case this.LEFT:
                        cursor = "w-resize";
                        break
                    default:
                        cursor = "move";
                }
            } 
        }
        this.viewport.parent.css({cursor: cursor});
        return false;
    },

    handleClick: function(event) {
        var self = this;

        if (event.button != 0)
            return false;
        var cpoint = this.viewport.getContentPosition(
                new DziViewer.Point(event.pageX, event.pageY));
        for (var i in this._rects) {
            var rect = this._rects[i];
            var offset = rect.topLeft();

            var edge = this.hitsEdge(rect, cpoint);
            if (edge != this.NOEDGE || rect.contains(cpoint)) {
                this.trigger("interactingStart");
                $(document).bind("mousemove.trackme", function(mevent) {
                    var npoint = self.viewport.getContentPosition(
                        new DziViewer.Point(mevent.pageX, mevent.pageY));
                    switch (edge) {
                        case self.RIGHT:
                            rect.x1 = Math.max(npoint.x, rect.x0 + self.MINSIZE);
                            break;
                        case self.BOTTOM:
                            rect.y1 = Math.max(npoint.y, rect.y0 + self.MINSIZE);
                            break;
                        case self.LEFT:
                            rect.x0 = Math.min(npoint.x, rect.y1 - self.MINSIZE);
                            break;
                        case self.TOP:
                            rect.y0 = Math.min(npoint.y, rect.y1 - self.MINSIZE);
                            break;
                        case self.TOPLEFT:
                            rect.x0 = Math.min(npoint.x, rect.y1 - self.MINSIZE);
                            rect.y0 = Math.min(npoint.y, rect.y1 - self.MINSIZE);
                            break;
                        case self.TOPRIGHT:
                            rect.x1 = Math.max(npoint.x, rect.x0 + self.MINSIZE);
                            rect.y0 = Math.min(npoint.y, rect.y1 - self.MINSIZE);
                            break;
                        case self.BOTTOMRIGHT:
                            rect.x1 = Math.max(npoint.x, rect.x0 + self.MINSIZE);
                            rect.y1 = Math.max(npoint.y, rect.y0 + self.MINSIZE);
                            break;
                        case self.BOTTOMLEFT:
                            rect.x0 = Math.min(npoint.x, rect.y1 - self.MINSIZE);
                            rect.y1 = Math.max(npoint.y, rect.y0 + self.MINSIZE);
                            break;
                        default:
                            rect.x = offset.x + (npoint.x - cpoint.x);
                            rect.y = offset.y + (npoint.y - cpoint.y);
                    }

                    self.update();
                });
                $(document).bind("mouseup.trackme", function(uevent) {
                    self.trigger("interactingStop");
                    $(document).unbind(".trackme");
                });
                return true;    
            }
        }
        return false;
    },
});


