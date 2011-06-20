// Aggregates X number of Seadragon Viewers a set of switchable buffers
// Syncing of zooming and position is always set to the currently
// viewed buffer

if (OCRJS === undefined) {
    var OCRJS = {};
}

Seadragon.Config.blendTime = 0;
Seadragon.Config.animationTime = 0;

OCRJS.ImageViewer = OCRJS.OcrBaseWidget.extend({
    constructor: function(parent, options) {
        this.base();
        this.parent = parent;
        this.options = {
            id: new Date().getTime(),
            numBuffers: 2,        
            width: -1,
            height: 500,
            log: false,
            dashboard: true,        
        };
        $.extend(this.options, options);

        if (this.options.width == -1) {
            this.options.width = $(this.parent).width();
        }

        this._listeners = {
            onBufferRefresh: [],
            resized: [],
            closed: [],
        };

        this._cbuf = 0;
        this._syncfunc = null;
        this._viewport = null;
        this._overlay = null;
        this._portals = [];
        this._buffers = [];
        this._rects = [];
        this._paths = [];

        // set up UI and init events
        this.init();
    },

    init: function() {
        this._viewport = $("<div><div>")
            .addClass("imageviewer_viewport")
            .attr("id", this.options.id + "_viewport")
            .height(this.options.height);
        this._portalholder = $("<div></div>");
        this._overlay = $("<div></div>")
            .addClass("imageviewer_overlay")
            .attr("id", this.options.id + "_overlay")
            .hide();
        $(this.parent)
            .append(this._overlay)
            .append(this._viewport.append(this._portalholder));

        for (var i = 0; i < this.options.numBuffers; i++) {
            var pid = this.options.id + "_portal" + i;
            var portal = $("<div></div>")
                .height(this.options.height)
                .addClass("imageviewer_portal")
                .attr("id", pid)
                .appendTo(this._portalholder);
            this._portals.push(portal); 
            this._buffers.push(new Seadragon.Viewer(pid));
            this._rects.push(null);
        }

        // cache function for wiring up syncing across
        // each buffer - this is a little gross.  We store
        // a ref to the function to easily add/remove it
        // as an event listeners running with the correct
        // scope.
        var self = this;
        this._syncfunc = function() {
            self.syncToActiveBuffer();
        }
        this.refreshDashboard();
        this.setMasterBuffer();
    },

    setDashboardVisible: function(show) {
        this.options.dashboard = show;
        this.refreshDashboard(show);
    },          

    refreshDashboard: function() {
        for (var i in this._buffers) {
            this._buffers[i].setDashboardEnabled(
                this.options.dashboard);
        }
    },

    close: function() {
        for (var i in this._buffers) {
            if (this._buffers[i].isOpen()) {
                this._buffers[i].close();
            }
        }
    },               

    resetSize: function() {
        var width = $(this.parent).width(),
            height = $(this.parent).height();        
        this._viewport
            .height(height)
            .width(width);
        this._overlay
            .height(height)
            .width(width);
        for (var i in this._portals) {
            this._portals[i]
                .width(width)
                .height(height);
        }
        this.options.height = height;
        this.options.width = width;
        this.refreshBuffers();        
    },

    height: function() {
        return $(this.parent).height();
    },                

    width: function() {
        return $(this.parent).width();
    },        

    isReady: function() {
        for (var i in this._buffers) {
            if (!this._buffers[i].viewport) {
                return false;
            }
        }
        return true;
    },                

    setWaiting: function(wait) {
        this._overlay.css({
            top: this._viewport.position().top,
            left: this._viewport.position().left,
            width: this._viewport.width(),
            height: this._viewport.height(),
        }).toggle(wait);
    },

    // set the path to a viewer and wire it to switch back
    // to the original position and zoom...
    setBufferPath: function(bufnum, dzipath) {
        this._paths[bufnum] = dzipath;                       
        var buffer = this._buffers[bufnum];                       
        if (buffer.isOpen()) {
            var center = buffer.viewport.getCenter();
            var zoom = buffer.viewport.getZoom();
            buffer.addEventListener("open", function(e) {
                buffer.viewport.panTo(center, true); 
                buffer.viewport.zoomTo(zoom, true); 
            });
        }
        buffer.openDzi(dzipath);
        this.callListeners("onBufferRefresh", bufnum);        
    },

    bufferPath: function(bufnum) {
        return this._paths[bufnum];
    },

    activeBufferPath: function() {
        return this._paths[this._cbuf];
    },                

    activeBuffer: function() {
        return this._cbuf;
    },

    setActiveBuffer: function(bufnum) {
        if (bufnum + 1 > this.options.numBuffers)
            throw "Can't set buffer to " + bufnum + ".  Only " 
                + this.options.numBuffers + " available";
        this._cbuf = bufnum;                   
        this.refreshBuffers();
    },

    bufferOverlays: function(bufnum) {
        return this._rects[bufnum];
    },

    activeBufferOverlays: function(bufnum) {
        return this._rects[this._cbuf];
    },

    activeViewer: function() {
        return this._buffers[this._cbuf];
    },                    
    
    // set overlay elements for a given buffer, or if
    // no nuffer number given, all buffers                     
    setBufferOverlays: function(rects, bufnum) {
        if (bufnum && typeof bufnum == "object") {
            for (var i in bufnum) {
                this._rects[bufnum[i]] = rects;
            }
        } else if (bufnum) {
            this._rects[bufnum] = rects;
        } else {
            for (var i in this._rects) {
                this._rects[i] = rects;
            }
        }

        // FIXME: hack around the viewport not
        // being built the first time we try to
        // draw overlays
        var self = this;
        if (this.isReady()) {
            self.drawBufferOverlays(); 
        } else {
            setTimeout(function() {
                self.drawBufferOverlays();
            }, 200);        
        }
    },                           

    drawBufferOverlays: function() {
        for (var i in this._buffers) {
            var portal = this._portals[i];
            var viewer = this._buffers[i];
            var overlays = this._rects[i];            
            if (!viewer || !viewer.drawer || !overlays)
                continue;
            //viewer.drawer.clearOverlays();
            $(".viewer_highlight", portal).each(function(i, elem) {
                viewer.drawer.removeOverlay(elem);
            });
            var overlaydiv;
            var fulldoc = viewer.source.dimensions;

            $.each(overlays, function(class, rects) {
                for (var r in rects) {
                    overlaydiv = document.createElement("div");
                    $(overlaydiv).addClass("viewer_highlight " + class);
                    var sdrect = new Seadragon.Rect(
                        rects[r][0] / fulldoc.x,
                        rects[r][1] / fulldoc.x,
                        (rects[r][2] - rects[r][0]) / fulldoc.x,
                        (rects[r][3] - rects[r][1]) / fulldoc.x);
                    viewer.drawer.addOverlay(overlaydiv, sdrect);         
                }            
            });
        } 
    },

    nextBuffer: function() {
        if (this._cbuf < this.options.numBuffers - 1) {
            this._cbuf++;    
        } else {
            this._cbuf = 0;
        }
        this.refreshBuffers();
    },

    refreshBuffers: function() {
        this._portalholder.css("margin-top", "-" 
                + (this._cbuf * this.options.height) + "px");
        this.setMasterBuffer();        
    },
                    
    // Sync background buffers to the foreground one
    syncToActiveBuffer: function() {
        //this._logger("Syncing others to: " + this._cbuf);                            
        var active = this._buffers[this._cbuf];
        for (i in this._buffers) {
            if (i != this._cbuf) {
                this._buffers[i].viewport.zoomTo(active.viewport.getZoom(), true);
                this._buffers[i].viewport.panTo(active.viewport.getCenter(), true);
            }
        }
    },
                        
    // sync movement of inactive viewers to the
    // active one                    
    setMasterBuffer: function() {
        for (var i in this._buffers) {
            this._buffers[i].removeEventListener("animation", this._syncfunc);         
        }
        this._logger("Setting sync to: " + this._cbuf);
        this._buffers[this._cbuf].addEventListener("animation", this._syncfunc);
    },

    // wrappers for viewport functions
    zoomBy: function(zoom, immediately) {
        this._buffers[this._cbuf].viewport.zoomBy(zoom, immediately);
    },

    goHome: function() {
        this._buffers[this._cbuf].viewport.goHome();
    },

    setFullPage: function(fullpage) {
        this._buffers[this._cbuf].setFullPage(fullpage);
    },

    fitBounds: function(rect, immediately) {
        var sd = this.sourceRectToSeadragon(
                this._cbuf, rect[0], rect[1], rect[2], rect[3]);
        this._buffers[this._cbuf].viewport.fitBounds(sd, immediately);        
    },

    sourceRectToSeadragon: function(bufnum, x0, y0, x1, y1) {
        if (!this._buffers[bufnum])
            throw "Buffer out of range: " + bufnum;
        if (!this._buffers[bufnum].source)
            throw "Buffer " + bufnum + " has no source loaded";        
        var src = this._buffers[bufnum].source.dimensions;
        return new Seadragon.Rect(x0 / src.x, y0 / src.x, (x1 - x0) / src.x, (y1 - y0) / src.x);
    },                         
});


