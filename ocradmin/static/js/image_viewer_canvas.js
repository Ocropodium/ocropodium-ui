// Extends ImageViewer with the facility to draw rects on top
// using a pen mode

if (OCRJS === undefined) {
    var OCRJS = {};
}


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


OCRJS.ImageViewerCanvas = OCRJS.ImageViewer.extend({
    constructor: function(parent, options) {
        this.base(parent, options);
    
        this._canvas = null;
        this._shapes = [];
        this._canvas = $("<div></div>")
            .addClass("imageviewer_canvas")
            .attr("id", this.options.id + "_canvas");
        $(this.parent).append(this._canvas);

        //this.updateSize(this.options.width, this.options.height);
        this.setupEvents();

        this._dragstart = null;
        this._droprect = null;

        this._colors = [
            ["#FFBBBB", "#FF8888"],
            ["#BBFFBB", "#88FF88"],
            ["#BBBBFF", "#8888FF"],
            ["#9966CC", "#9900CC"],
            ["#FFFF88", "#FFFF66"],
            ["#66BB00", "#339900"],
        ];

        var self = this;
        setTimeout(function() {
            //self.toggleDrawMode(true);        
        });

        this.registerListener("onCanvasChanged");
    },

    toggleDrawMode: function(draw) {
        this._canvas.css({
            top: this._viewport.position().top,
            left: this._viewport.position().left,
            width: this._viewport.width(),
            height: this._viewport.height(),
        });
        this._canvas.toggle(draw);
    },

    
    getRects: function() {
        var bufelem = this.activeViewer().elmt;
        var bufpos = Seadragon.Utils.getElementPosition(bufelem);
        var bufsize = Seadragon.Utils.getElementSize(bufelem);

        var vp = this.activeViewer().viewport;
        var csize = vp.getContainerSize();
        var zoom = vp.getZoom();
        var centre = vp.getCenter();
        var bounds = vp.getBounds();

        var fw = csize.x * zoom, fh = csize.y * zoom;
        var fx = -1 * ((fw * centre.x) - (csize.x / 2)),
            fy = -1 * ((fh * centre.y) - (csize.y / 2));

        console.log("Viewer: ", bufpos, bufsize);

        var fsize = this.activeViewer().source.dimensions;

        var shapepos, shapesize;
        $.each(this._shapes, function(i, elem) {
            shapepos = vp.pointFromPixel(Seadragon.Utils.getElementPosition(elem));                 
            shapesize = vp.pointFromPixel(Seadragon.Utils.getElementSize(elem));

            var x = (shapepos.x * fsize.x) - bufpos.x,
                y = (shapepos.y * fsize.x) - bufpos.y,
                w = shapesize.x * fsize.x,
                h = shapesize.y * fsize.y;

            console.log("Rect: ", x, y, w, h); 
        });            
    },                  


    dragDone: function() {
        this._logger("up");
        this._droprect = null;
        this._dragstart = null;
        this._hndl.setTracking(true);
        this._canvas.unbind("mousemove.drawcanvas");
        this._canvas.unbind("mouseup.drawcanvas");
        this.callListeners("onCanvasChanged");
    },              

    
    setupEvents: function() {
        var self = this;

        $(window).bind("keydown", function(event) {
            console.log(event.keyCode + " " + event.ctrlKey);
            if (event.keyCode == KC_CTRL)
                self.toggleDrawMode(true);
        });

        $(window).bind("keyup", function(event) {
            if (event.keyCode == KC_CTRL) {
                self.dragDone();
                self.toggleDrawMode(false);
            }            
        });

        this._canvas.bind("mousedown.drawcanvas", function(event) {
            self._dragstart = {x: event.pageX, y: event.pageY };
            // initialise drawing           
            self._canvas.bind("mousemove.drawcanvas", function(event) {
                var create = false;
                if (self._dragstart != null &&
                    self._normalisedRectArea(self._dragstart.x, self._dragstart.y,
                        event.pageX, event.pageY) > 300) {
                    if (self._droprect == null) {
                        self._initialiseNewRect();
                        create = true;
                    }
                }

                if (self._droprect) {
                    var x0 = self._dragstart.x - self._canvas.offset().left,
                        y0 = self._dragstart.y - self._canvas.offset().top,
                        x1 = event.pageX - self._canvas.offset().left,                        
                        y1 = event.pageY - self._canvas.offset().top,
                        sdrect = self._normalisedRect(x0, y0, x1, y1);

                    var func = create
                        ? self.activeViewer().drawer.addOverlay
                        : self.activeViewer().drawer.updateOverlay;
                    func(self._droprect, sdrect); 
                }
            });

            self._canvas.bind("mouseup.drawcanvas", function(event) {
                self.dragDone();                    
            });
        });

        //$(".layout_rect").live("hover", function(event) {
        //    self._logger(event.type);
        //    if (event.type == "mouseover") {
        //        $(this).addClass("hover");
        //    } else {
        //        $(this).removeClass("hover");
        //    }
        //});        

    },                    

    updateSize: function(width, height) {
        this.base(width, height);
        this._canvas.css({
            top: this._viewport.position().top,
            left: this._viewport.position().left,
            width: this._viewport.width(),
            height: this._viewport.height(),
        });
    },

    _initialiseNewRect: function() {                
        var self = this;
        self._droprect = document.createElement("div");
        var idx = self._shapes.length;
        $(self._droprect)
            .addClass("layout_rect")
            .css({
                backgroundColor: self._colors[idx][0],
                borderColor: self._colors[idx][1],
            })
            .append(
                    $("<div></div>")
                        .addClass("layout_rect_label")
                        .text(idx + 1)
            )
            .resizable({handles: "all"})
            .draggable();
        self._shapes.push(self._droprect);

        self._hndl = new Seadragon.MouseTracker(self._droprect);
        self._hndl.pressHandler = function(tracker, pos, quick, shift) {
            self.activeViewer().setMouseNavEnabled(false);
            self._logger("ok!");
        }
        self._hndl.clickHandler = function(tracker, pos, quick, shift) {
            if (shift)
                self._deleteRect(tracker.target);
        }
        self._hndl.enterHandler = function(tracker, pos, btelem, btany) {
            $(window).bind("keydown.setorder", function(event) {
                if (event.keyCode >= KC_ONE && event.keyCode <= KC_NINE)
                    self._setRectOrder(
                            tracker.target, event.keyCode - KC_ZERO);
            });
        }
        self._hndl.exitHandler = function(tracker, pos, btelem, btany) {
            $(window).unbind("keydown.setorder");
        }
        self._hndl.dragHandler = function(tracker, pos, delta, shift) {
        }

        self._hndl.releaseHandler = function(tracker, pos, insidepress, insiderelease) {
            self.activeViewer().setMouseNavEnabled(true);
            var ele = $(tracker.target),
                x0 = ele.position().left,
                y0 = ele.position().top,
                x1 = x0 + ele.width(),                        
                y1 = y0 + ele.height(),
                sdrect = self._normalisedRect(x0, y0, x1, y1);
            self.activeViewer().drawer.updateOverlay(tracker.target, sdrect);
        } 
    },

    _deleteRect: function(elem) {
        var tmp = [];
        for (var i in this._shapes) {
            if (this._shapes[i] !== elem)
                tmp.push(this._shapes[i]);
        }
        this._shapes = tmp;        
        var next = parseInt($(".layout_rect_label", elem).text());
        for (var i in this._shapes) {
            if (parseInt($(".layout_rect_label", this._shapes[i]).text()) > next) {
                $(".layout_rect_label", this._shapes[i]).text(next);
                next++;
            }
        }            
        this._buffers[this.activeBuffer()].drawer.removeOverlay(elem);
        $(elem).remove();
        this._hndl = null;
        this._droprect = null;
    },                     

    _normalisedRect: function(x0, y0, x1, y1) {
        var sdx0 = this.activeViewer().viewport.pointFromPixel(
            new Seadragon.Point(x0 < x1 ? x0 : x1, y0 < y1 ? y0 : y1));
        var sdx1 = this.activeViewer().viewport.pointFromPixel(
            new Seadragon.Point(x1 > x0 ? x1 : x0, y1 > y0 ? y1 : y0));
        return new Seadragon.Rect(sdx0.x, sdx0.y, 
                sdx1.x - sdx0.x, sdx1.y - sdx0.y);
    },

    _setRectOrder: function(elem, num) {
        if (num > this._shapes.length)
            return;            
        var curr = parseInt($(elem).text());                       
        for (var i in this._shapes) {
            if (this._shapes[i] !== elem &&
                    parseInt($(this._shapes[i]).text()) == num) {
                $(".layout_rect_label", this._shapes[i]).text(curr);
            }
        }
        $(".layout_rect_label", elem).text(num);
    },                    

    _normalisedRectArea: function(x0, y0, x1, y1) {
        return Math.abs(x1 - x0) * Math.abs(y1 - y0);    
    }                
});

