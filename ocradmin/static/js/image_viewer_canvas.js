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

    
    setupEvents: function() {
        var self = this;

        $(window).bind("keydown", function(event) {
            self._logger(event.keyCode + " " + event.altKey);
            if (event.keyCode == 17 && event.altKey 
                    || event.keyCode == 18 && event.ctrlKey)
                self.toggleDrawMode(true);
        });

        $(window).bind("keyup", function(event) {
            if (event.keyCode == 17 || event.keyCode == 18)
                self.toggleDrawMode(false);            
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
                    var x0 = self._dragstart.x - self._canvas.offset().left;
                    var y0 = self._dragstart.y - self._canvas.offset().top;
                    var x1 = event.pageX - self._canvas.offset().left;                        
                    var y1 = event.pageY - self._canvas.offset().top;
                    var sdrect = self._normalisedRect(x0, y0, x1, y1);

                    var func = create
                        ? self.activeViewer().drawer.addOverlay
                        : self.activeViewer().drawer.updateOverlay;
                    func(self._droprect, sdrect); 
                }
            });

            self._canvas.bind("mouseup.drawcanvas", function(event) {
                self._logger("up");
                self._droprect = null;
                self._dragstart = null;
                self._hndl.setTracking(true);
                self._canvas.unbind("mousemove.drawcanvas");
                self._canvas.unbind("mouseup.drawcanvas");
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
            if (shift) {
                self._deleteRect(tracker.target);
            }

        }
        self._hndl.enterHandler = function(tracker, pos, btelem, btany) {
            $(window).bind("keydown.setorder", function(event) {
                if (event.keyCode >= 49 && event.keyCode <= 57) {
                    self._setRectOrder(tracker.target, event.keyCode - 48);
                }
            });
        }
        self._hndl.exitHandler = function(tracker, pos, btelem, btany) {
            $(window).unbind("keydown.setorder");
        }
        self._hndl.dragHandler = function(tracker, pos, delta, shift) {
        }

        self._hndl.releaseHandler = function(tracker, pos, insidepress, insiderelease) {
            self.activeViewer().setMouseNavEnabled(true);
            var ele = $(tracker.target);
            var x0 = ele.position().left;
            var y0 = ele.position().top;
            var x1 = x0 + ele.width();                        
            var y1 = y0 + ele.height();
            var sdrect = self._normalisedRect(x0, y0, x1, y1);
            self.activeViewer().drawer.updateOverlay(tracker.target, sdrect);
        } 
    },

    _deleteRect: function(elem) {
        var tmp = [];
        for (var i in this._shapes) {
            if (this._shapes[i] !== elem) {
                tmp.push(this._shapes[i]);
            }
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

