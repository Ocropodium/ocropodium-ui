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

        this.buffer = $("<canvas></canvas>")
            .prop("width", this.parent.width())
            .prop("height", this.parent.height())
            .css("marginTop", -5000)
            .appendTo(this.parent);
        this.canvas = $("<canvas></canvas>")
            .prop("width", this.parent.width())
            .prop("height", this.parent.height())
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

    removeOverlayPlugin: function(plug) {
        this.viewport.removeEventFilter(plug);
        this.loader.removeListeners(".plugdraw");
        plug.removeListeners("update");
        this.overlay.get(0).getContext("2d").clearRect(
                0, 0, this.viewport.width, this.viewport.height);
    },                             

    update: function(buffered) {
        console.log("call update", this.viewport, this.source, this.loader, buffered);
        if (this.source !== null)                
            this.drawer.drawTiles(
                    this.viewport, this.source, this.loader, buffered);
    },                  

    load: function(path) {
        console.log("Loading", path);
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
        if (self.source !== null)
            this.viewport.centerOn(new DziViewer.Size(
                        this.source.width, this.source.height));
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


