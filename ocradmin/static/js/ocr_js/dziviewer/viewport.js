// 
// Viewport object
//


var DziViewer = DziViewer || {};

DziViewer.ViewPort = OcrJs.Base.extend({
    init: function(parent, options) {
        this._super();
        this.options = {
            minzoom: 0.05,
            maxzoom: 10,
            zoomstep: 0.1,
        };
        $.extend(this.options, options);    

        this.parent = $(parent);             
        this._scale = 1;
        this.translate = new DziViewer.Point(0, 0);
        self.interacted = false;
        this.width = $(parent).width();
        this.height = $(parent).height();

        this._eventfilters = [];

        this.setupEvents();

        this.registerListener("update");
        this.registerListener("panned");
        this.registerListener("zoomed");

        this.__defineGetter__("scale", function() {
            return this._scale;
        });

        this.__defineSetter__("scale", function(s) {
            this._scale = Math.max(this.options.minzoom, s);
        });
    },

    resetSize: function() {
        this.width = this.parent.width();
        this.height = this.parent.height();
    },             

    addEventFilter: function(filter) {
        console.assert(this._eventfilters.indexOf(filter) == -1,
                "Attempt to add an event filter twice!");
        this._eventfilters.push(filter);
    },

    removeEventFilter: function(filter) {
        this._eventfilters.splice(
                this._eventfilters.indexOf(filter), 1);
    },

    clearEventFilters: function() {
        this._eventfilters = [];
    },                           

    setupEvents: function() {
        var self = this;

        self.parent.bind("mousemove", function(event) {
            if (self._checkIntercepted("mousemove", event))
                return;
        });

        // bind a keydown event when the mouse is inside the viewer
        self.parent.bind("mouseenter", function(event) {
            $(document).bind("keydown.viewerkey", function(kevent) {
                if (self._checkIntercepted("keydown", kevent)) {
                    kevent.stopPropagation();
                    kevent.preventDefault();
                }
            });
        });        
        self.parent.bind("mouseleave", function(event) {
            $(document).unbind("keydown.viewerkey");
        });

        self.parent.bind("mousedown", function(event) {
            if (self._checkIntercepted("mousedown", event) 
                || event.button == 2)
                return;

            var start = null;
            var offset = self.translate.clone();
            $(document).bind("mousemove.movetrack", function(mevent) {
                if (!start)
                    start = {x: event.pageX, y: event.pageY};
                var diff = new DziViewer.Point(
                        mevent.pageX - start.x,
                        mevent.pageY - start.y
                );
                if (diff.x || diff.y) {
                    self.interacted = true;
                    self.translate.x = offset.x + diff.x;
                    self.translate.y = offset.y + diff.y;
                    self.trigger("panned");
                }
            });
            $(document).bind("mouseup.movetrack", function(uevent) {
                $(document).unbind(".movetrack");
                start = null;
            });
        });

        // ... and with mouse wheel
        self.parent.bind("mousewheel", function(event, delta) {
            if (self._checkIntercepted("mousewheel", event, delta))
                return;

            var factor = delta > 0 ? 1.2 : 0.8;
            var point = new DziViewer.Point(
                event.pageX - self.parent.offset().left,
                event.pageY - self.parent.offset().top
            );
            self.interacted = true;
            self.zoomAtPoint(point, factor);
            event.preventDefault();
            event.stopPropagation();
        });
    },

    getCenter: function() {
        return this.translate.clone();
    },        

    zoomTo: function(scale, dontupdate) {
        this.scale = scale;
        if (!dontupdate)
            this.trigger("zoomed");
    },

    zoomIn: function(factor, dontupdate) {
        var factor = factor || 1.2;
        this.zoomAtPoint(this.getCenter(), factor, dontupdate);
    },               

    zoomOut: function(factor, dontupdate) {
        var factor = factor || 0.8;
        this.zoomAtPoint(this.getCenter(), factor, dontupdate);
    },                 

    zoomAtPoint: function(point, factor, dontupdate) {                           
        var sx = this.scale * factor;
        if (sx < this.options.minzoom || sx > this.options.maxzoom)
            return false;

        // this appears to be the correct formula for translating
        // the canvas so the point under the mouse stays the same
        // when zoomed...
        this.scale = sx;
        this.translate.x += (point.x - this.translate.x) * (1 - factor);
        this.translate.y += (point.y - this.translate.y) * (1 - factor);
        if (!dontupdate)
            this.trigger("zoomed");
    },
     
    getScaleToFit: function(size) {
        return size.getAspect() < this.getSize().getAspect() 
                ? this.height / size.height
                : this.width / size.width;
    },

    centerOn: function(size, dontupdate) {                  
        this.scale = this.getScaleToFit(size);
        this.translate.x = Math.ceil((this.width - (size.width * this.scale)) / 2);
        this.translate.y = Math.ceil((this.height - (size.height * this.scale)) / 2);
        if (!dontupdate)
            this.trigger("zoomed");
    },

    getSize: function() {
        return new DziViewer.Size(this.width, this.height);
    },

    getRect: function() {
        return new DziViewer.Rect(
                -this.translate.x,
                -this.translate.y,
                -this.translate.x + this.width,
                -this.translate.y + this.height
        );
    },

    // compat functions
    getZoom: function() {
        return this.scale;
    },

    getContentPosition: function(pagepos) {
        var off = this.parent.offset();
        return new DziViewer.Point(
               (pagepos.x - this.translate.x - off.left) / this.scale,
               (pagepos.y - this.translate.y - off.top) / this.scale
        );
    },

    _checkIntercepted: function() {
        for (var i in this._eventfilters) {
            if (this._eventfilters[i].handleEvent.apply(
                        this._eventfilters[i], arguments))
                return true;
        }
        return false;
    },
});

