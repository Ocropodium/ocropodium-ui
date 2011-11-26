//
// Draw a tile source to the canvas
//


var DziViewer = DziViewer || {};

DziViewer.Drawer = OcrJs.Base.extend({
    init: function(canvas, buffer, options) {
        this._super();
        this.canvas = canvas;
        this.buffer = buffer;
        this.options = {
            debug: false,
            debugColor: "#666",
        };

        $.extend(this.options, options);

        // initialize the canvas and buffer canvas
        this._ctx = canvas.get(0).getContext("2d");
        this._ctx.fillStyle = "#fff";
        this._ctx.strokeStyle = this.options.debugColor;
        this._buf = buffer.get(0).getContext("2d");
        this._buf.fillStyle = "#fff";
        this._buf.strokeStyle = this.options.debugColor;
        this._cache = new DziViewer.ImageCache();

        this._listeners = {
            contextReady: [],
            initialDraw: [],
        };
    },

    getRenderCallback: function(tilesource, viewport, level, rect, context) {
        var self = this;
        return function(p, img) {
            self._cache.set(level, p, img);
            var adjust = tilesource.getAdjustmentFactor(viewport.scale, level);
            rect = rect.adjust(adjust).shiftBy(viewport.translate);
            context.drawImage(img, rect.x0, rect.y0, rect.width, rect.height);
            if (self.options.debug)
                context.strokeRect(rect.x0, rect.y0, rect.width, rect.height);
        };
    },

    clearCanvas: function(context, width, height) {
        context.clearRect(0, 0, width, height);
    },

    getContext: function() {
        return this._ctx;
    },

    drawTiles: function(viewport, tilesource, loader, buffer) {
        var self = this;
        var toplevel = tilesource.getNearestLevel(viewport.scale);

        var context = buffer ? this._buf : this._ctx;
        var startlevel = buffer ? toplevel : 0;
        this.clearCanvas(context, this.canvas.width(), this.canvas.height());

        // FIXME: currently we draw all previous levels that have an
        // appropriate image in order of resolution.  This is very
        // inefficient, but it avoids doing tricky stuff figuring
        // out the nearest level prior to the active one that has
        // an appropriate tile already loaded.  There's probably a
        // an optimisation here, though FWIT, I haven't noticed any
        // performance issues caused by the current behaviour.
        var pathcbs = [];

        for (var level = startlevel; level <= toplevel; level++) {
            // the adjust factor is the diff between the current level
            // and the requested scale
            var adjust = tilesource.getAdjustmentFactor(viewport.scale, level);
            var all = tilesource.enumerate(level);
            for (var i in all) {
                var col = all[i][0], row = all[i][1];
                var rect = tilesource.getTileBounds(level, col, row);
                var adjusted = rect.adjust(adjust);
                var path = tilesource.getPath(level, col, row);

                // only render tiles within the viewport
                if (viewport.getRect().overlaps(adjusted)) {
                    var img = this._cache.get(level, path);
                    var callback = this.getRenderCallback(
                            tilesource, viewport, level, rect,
                            context);
                    if (img) {
                        callback(path, img);
                    } else if (level == toplevel) {
                        pathcbs.push({
                            path: path,
                            callback: callback,
                        });
                    }
                }
            }
        }

        if (buffer) {
            loader.addListener("loadedAll.buffer", function() {
                var img = self._buf.getImageData(
                    0, 0, self.buffer.prop("width"), self.buffer.prop("height"));
                self._ctx.putImageData(img, 0, 0);
                loader.removeListeners(".buffer");
            }, true);
        }
        loader.loadImages(pathcbs);

        this.trigger("initialDraw");
    },
});
