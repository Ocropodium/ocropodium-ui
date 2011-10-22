//
// GUI for crop node
//

var OcrJs = OcrJs || {};
OcrJs.NodeGui = OcrJs.NodeGui || {}

OcrJs.NodeGui.PilCropGui = DziViewer.Plugin.RectManager.extend({
    init: function(viewport, node) {
        this._super(viewport);
        this.node = node;

        this._coords = new DziViewer.Rect(-1,-1,-1,-1);

        this._rects = [];
        this._outline = null;
        this._color = "#FFBBBB";

        this.registerListener("parametersSet");

        this.readNodeData();
    },

    refresh: function() {
        this.readNodeData();
        this.trigger("update");
    },                 

    render: function(context) {
        context.save();

        context.clearRect(0, 0, this.viewport.width, this.viewport.height);
        context.fillStyle = "rgba(0,0,0,0.5)";
        context.fillRect(0, 0, this.viewport.width, this.viewport.height);
        context.strokeStyle = "rgba(15,80,120,0.5)";
        context.lineWidth = 10;
        context.strokeRect(0, 0, this.viewport.width, this.viewport.height);

        for (var i in this._rects) {
            var r = this._rects[i];
            context.clearRect(
                (r.x * this.viewport.scale) + this.viewport.translate.x,
                (r.y * this.viewport.scale) + this.viewport.translate.y, 
                r.width * this.viewport.scale, r.height * this.viewport.scale);
        }

        // draw the drag box if it exists...
        if (this._outline !== null) {
            context.lineWidth = 2;
            context.strokeStyle = "#000";
            context.fillStyle = "transparent";
            context.dashedRect(
                (this._outline.x * this.viewport.scale) + this.viewport.translate.x,
                (this._outline.y * this.viewport.scale) + this.viewport.translate.y, 
                this._outline.width * this.viewport.scale,
                this._outline.height * this.viewport.scale);
        }
        context.restore();
    },

    readNodeData: function() {
        console.log("Reading node data");
        var coords = this._coords;                      
        $.each(this.node.parameters, function(i, param) {
            if (coords[param.name])
                coords[param.name] = parseInt(param.value);            
        });

        this._rects = [coords];
    },                      

    handleClick: function(event) {
        if (this._super(event)) {
            return true;
        }

        if (event.button != 0)
            return false;

        this.trigger("interactingStart");

        var self = this;
        // we haven't handled a rect, so draw one
        var spoint = this.viewport.getContentPosition(
                new DziViewer.Point(event.pageX, event.pageY));
        $(document).bind("mousemove.drawoutline", function(mevent) {
            if (Math.sqrt(
                    (Math.abs(mevent.pageX - event.pageX)^2
                        + Math.abs(mevent.pageY - event.pageY)^2)) > 5) {
                var cpoint = self.viewport.getContentPosition(
                        new DziViewer.Point(mevent.pageX, mevent.pageY));
                if (self._outline === null)
                    self._outline = new DziViewer.Rect(spoint, cpoint).normalize();
                self._outline.x0 = Math.min(spoint.x, cpoint.x);
                self._outline.y0 = Math.min(spoint.y, cpoint.y);
                self._outline.x1 = Math.max(spoint.x, cpoint.x);
                self._outline.y1 = Math.max(spoint.y, cpoint.y);
                self.update();
            }
        });
        $(document).bind("mouseup.drawoutline", function(uevent) {
            $(document).unbind(".drawoutline");
            if (self._outline !== null && self._outline.area() > 50)
                self._rects[0] = self._outline.normalize().clone();
            self._outline = null;

            // NB: The order of these operations is important
            // if we stop interaction before update(), the
            // GUI will be forced to update from the existing
            // node data and the rect values get overwritten
            self.update();
            self.trigger("interactingStop");
        });        

        return true;
    },

    updateNodeParameters: function() {
        var self = this;
        this.trigger("parametersSet", this.node, {
            x0: Math.round(self._rects[0].x0),        
            y0: Math.round(self._rects[0].y0),        
            x1: Math.round(self._rects[0].x1),        
            y1: Math.round(self._rects[0].y1),        
        });
    },

    handleWheel: function(event, delta) {
        return false;
    },

    handleKeyDown: function(event) {
        return false;
    },

    update: function() {
        this.updateNodeParameters();
        this.trigger("update");
    },
});
