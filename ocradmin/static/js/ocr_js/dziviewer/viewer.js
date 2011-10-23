// 
// Main imageviewer object.
//

var DziViewer = DziViewer || {};

DziViewer.Viewer = OcrJs.Base.extend({
    init: function(parent, options) {
        this._super();
        this.parent = $(parent);

        this._path = null;

        this.options = {
            debug: false,
            delay: null,
        };
        $.extend(this.options, options);

        this._highlights = [];

        this.buffer = $("<canvas></canvas>")
            .prop("width", this.parent.width())
            .prop("height", this.parent.height())
            .css("marginTop", -5000)
            .appendTo(this.parent);
        this.canvas = $("<canvas></canvas>")
            .prop("width", this.parent.width())
            .prop("height", this.parent.height())
            .appendTo(this.parent);
        this.highlight = $("<canvas></canvas>")
            .prop("width", this.parent.width())
            .prop("height", this.parent.height())
            .css({
                position: "fixed",
                zIndex: 9,
                top: this.parent.offset().top,
                left: this.parent.offset().left,                
            })
            .appendTo(this.parent);
        this.overlay = $("<canvas></canvas>")
            .prop("width", this.parent.width())
            .prop("height", this.parent.height())
            .css({
                position: "fixed",
                zIndex: 10,
                top: this.parent.offset().top,
                left: this.parent.offset().left,                
            })
            .appendTo(this.parent);

        this.source = null;
        this.viewport = new DziViewer.ViewPort(this.parent, this.options);

        this._plugins = {};

        var self = this;
        this.viewport.addListeners({
            zoomed: function() { self.update(); },
            panned: function() { self.update(); },
            update: function() { self.update(); },
        });
        this.drawer = new DziViewer.Drawer(this.canvas, this.buffer, options);
        this.loader = new DziViewer.Loader();
    },

    addOverlayPlugin: function(plug) {
        var self = this;
        this.viewport.addEventFilter(plug);
        this.loader.addListener("loadedAll.plugdraw", function() {
            plug.render(self.overlay.get(0).getContext("2d"));
        });
        plug.addListener("update", function() {
            plug.render(self.overlay.get(0).getContext("2d"));
        });
    },

    clearOverlayPlugins: function() {
        this.viewport.clearEventFilters();
        this.loader.removeListeners(".plugdraw");
        this.update();
    },                             

    removeOverlayPlugin: function(plug) {
        this.viewport.removeEventFilter(plug);
        this.loader.removeListeners(".plugdraw");
        console.log("Removing overlays", plug);
        plug.removeListeners("update");
        this.overlay.get(0).getContext("2d").clearRect(
                0, 0, this.viewport.width, this.viewport.height);
    },   

    addHighlight: function(rect, strokestyle, fillstyle) {
        var strokestyle = strokestyle || "rgba(255,255,0,0.3)";
        var fillstyle = fillstyle || "rgba(255,255,0,0.3)";
        this._highlights.push({
            rect: rect,
            stroke: strokestyle,
            fill: fillstyle,
        });
    },

    clearHighlights: function() {
        this._highlights = [];
    },                        

    removeHighlight: function(rect) {
        for (var i in this._highlights) {
            if (rect.isSameAs(this._highlights[i].rect)) {
                this._highlights.splice(i, 1);            
                return true;
            }
        }            
    },                         

    drawHighlights: function() {
        var ctx = this.highlight.get(0).getContext("2d");
        ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
        ctx.save();
        for (var i in this._highlights) {                        
            var rect = this._highlights[i].rect;
            ctx.lineWidth = 1;
            ctx.strokeStyle = this._highlights[i].stroke;
            ctx.fillStyle = this._highlights[i].fill;
            ctx.strokeRect(
                    rect.x * this.viewport.scale + this.viewport.translate.x,
                    rect.y * this.viewport.scale + this.viewport.translate.y,
                    rect.width * this.viewport.scale, rect.height * this.viewport.scale);
            ctx.fillRect(
                    rect.x * this.viewport.scale + this.viewport.translate.x,
                    rect.y * this.viewport.scale + this.viewport.translate.y,
                    rect.width * this.viewport.scale, rect.height * this.viewport.scale);
        }
        ctx.restore();
    },                        

    update: function(buffered) {
        if (this.source !== null) {
            this.drawer.drawTiles(
                    this.viewport, this.source, this.loader, buffered);
            this.drawHighlights();
        }
    },                  

    load: function(path) {
        var self = this;              
        this._path = path;
        $.ajax({
            url: path,
            datatype: "xml",
            success: function(data) {
                self.source = new DziViewer.TileSource(path, $($.parseXML(data)));
                if (!self.viewport.interacted) {
                    self.viewport.centerOn(new DziViewer.Size(
                            self.source.width,
                            self.source.height
                    ), true);
                }

                // update with buffering
                self.update(true);
            },
            error: function(xhr, status, errorThrown) {
                console.error("XHR Error:", status, errorThrown);
            }, 
        });        
    },

    goHome: function() {
        if (self.source !== null) {
            this.viewport.centerOn(new DziViewer.Size(
                        this.source.width, this.source.height));
            this.viewport.interacted = false;
        }
    },    

    fitBounds: function(rect) {
        if (self.source === null)
            return;

        this.viewport.centerOn(rect.getSize(), true);
        this.viewport.translate.x -= rect.x * this.viewport.scale;
        this.viewport.translate.y -= rect.y * this.viewport.scale;
        this.viewport.trigger("zoomed");
    },                   

    refresh: function() {
        this.update();
    },

    resetSize: function() {
        this.viewport.resetSize();
        this.canvas
            .prop("width", this.viewport.width)
            .prop("height", this.viewport.height);
        this.buffer
            .prop("width", this.viewport.width)
            .prop("height", this.viewport.height);
        this.highlight
            .prop("width", this.viewport.width)
            .prop("height", this.viewport.height)
            .css({
                top: this.parent.offset().top,
                left: this.parent.offset().left
            });
        this.overlay
            .prop("width", this.viewport.width)
            .prop("height", this.viewport.height)
            .css({
                top: this.parent.offset().top,
                left: this.parent.offset().left
            });
        this.update();
    },             

    openDzi: function(dzipath) {
        this.load(dzipath, true);
    },        

    close: function() {
        var self = this;
        $.each([this.canvas, this.overlay, this.buffer], function(i, c) {
            self.drawer.clearCanvas(c.get(0).getContext("2d"),
                self.viewport.width, self.viewport.height);        
        });
        
        this.source = null;
    },

    isOpen: function() {
        return this.source !== null;
    },

    isReady: function() {
        return this.isOpen();
    },                 

    setWaiting: function(wait) {

    },                    
});    


