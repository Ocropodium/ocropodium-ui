//
// GUI for crop node
//

var OCRJS = OCRJS || {};
OCRJS.NodeGui = OCRJS.NodeGui || {}


OCRJS.NodeGui.SegmentPageManualGui = DziViewer.Plugin.RectManager.extend({
    init: function(viewport, node) {
        this._super(viewport);
        this.node = node;

        this._colors = [
            ["rgba(255,187,187,0.7)", "rgba(255,187,187,0.2)"],
            ["rgba(187,255,187,0.7)", "rgba(187,255,187,0.2)"],
            ["rgba(187,187,255,0.7)", "rgba(187,187,255,0.2)"],
            ["rgba(153,102,204,0.7)", "rgba(153,102,204,0.2)"],
            ["rgba(255,255,136,0.7)", "rgba(255,255,136,0.2)"],
            ["rgba(102,187,0,0.7)",   "rgba(102,187,0,0.2)"],
            ["rgba(247,190,129,0.7)", "rgba(247,190,129,0.2)"],
            ["rgba(208,169,245,0.7)", "rgba(208,169,245,0.2)"],
            ["rgba(169,245,242,0.7)", "rgba(169,245,242,0.2)"],
        ];

        this._rects = [];
        this._outline = null;
        this._paramre = /^\s*([-\d]+)\s*,\s*([-\d]+)\s*,\s*([-\d]+)\s*,\s*([-\d]+)\s*$/;

        this.registerListener("parametersSet");
        
        this.readNodeData();
        this.trigger("update");
    },

    refresh: function() {
        this.readNodeData();
        this.trigger("update");
    },                 

    readNodeData: function() {
        var self = this;
        this._rects = [];        
        $.each(this.node.parameters, function(i, param) {
            if (param.name == "boxes") {
                var coordarray = param.value.split("~");
                $.each(coordarray, function(n, coordstr) {
                    var match = coordstr.match(self._paramre);
                    if (match) {
                        self._rects.push(new DziViewer.Rect(
                            parseInt(RegExp.$1),
                            parseInt(RegExp.$2),
                            parseInt(RegExp.$3),
                            parseInt(RegExp.$4)
                        ));
                    } else if ($.trim(coordstr) != "") {
                        console.error("Invalid box string:",  coordstr);
                    }
                });
            }
        });
    },                      

    render: function(context) {
        context.save();
        context.font = String(Math.ceil(Math.max(10, 60 * this.viewport.scale))) + "pt Arial";
        context.textBaseline = "top";
        context.clearRect(0, 0, this.viewport.width, this.viewport.height);

        context.strokeStyle = "rgba(15,80,120,0.5)";
        context.lineWidth = 10;
        context.strokeRect(0, 0, this.viewport.width, this.viewport.height);

        context.lineWidth = 2;
        var ci = 0;
        for (var i = 0; i < this._rects.length; i++) {
            var r = this._rects[i];
            if (ci > this._rects.length)
                ci = 0;
            
            context.strokeStyle = this._colors[ci][0];
            context.fillStyle = this._colors[ci][1];
            context.fillRect(
                (r.x * this.viewport.scale) + this.viewport.translate.x,
                (r.y * this.viewport.scale) + this.viewport.translate.y, 
                r.width * this.viewport.scale, r.height * this.viewport.scale);
            context.strokeRect(
                (r.x * this.viewport.scale) + this.viewport.translate.x,
                (r.y * this.viewport.scale) + this.viewport.translate.y, 
                r.width * this.viewport.scale, r.height * this.viewport.scale,
                5);
            context.fillStyle = "rgba(0,0,0,0.5)";
            context.fillText(String(i + 1),
                    ((r.x + 5) * this.viewport.scale) + this.viewport.translate.x,
                    ((r.y + 5) * this.viewport.scale) + this.viewport.translate.y);
            ci++;
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
                self._rects.push(self._outline.normalize().clone());
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

    handleKeyDown: function(event) {
        switch (event.keyCode) {                       
            case 46: // delete
                return this.handleDelete(event);
            case 49: 
            case 50: 
            case 51: 
            case 52: 
            case 53: 
            case 54: 
            case 55: 
            case 56: 
            case 57: 
            case 58: 
            case 59:
               return this.handleNumber(event); 
        }
        return false;
    },

    handleDelete: function(event) {
        if (this._current) {
            this._rects.splice(this._rects.indexOf(this._current), 1);
            this.update();
            return true;
        }
        return false;
    },      

    handleNumber: function(event) {
        var idx = event.which - 49;
        if (this._current) {
            if (idx < this._rects.length) {
                var curr = this._rects.indexOf(this._current);
                this._rects.splice(curr, 1);
                this._rects.splice(idx, 0, this._current);
                this.update();
                return true;
            }
        }
        return false;
    },

    update: function() {
        this.updateNodeParameters();
        this.trigger("update");
    },

    updateNodeParameters: function() {
        var self = this;        
        var rects = [];
        $.each(this._rects, function(i, r) {
            rects.push([
                Math.round(r.x0), Math.round(r.y0), 
                Math.round(r.x1), Math.round(r.y1)].join(","));
        });
        this.trigger("parametersSet", this.node, {
            boxes: rects.join("~")
        });
    },                             
});    


