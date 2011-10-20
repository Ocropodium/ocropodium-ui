//
// GUI for crop node
//

var OCRJS = OCRJS || {};
OCRJS.NodeGui = OCRJS.NodeGui || {}

OCRJS.NodeGui.ManualSegGui = OCRJS.NodeGui.BaseGui.extend({
    constructor: function(viewer) {
        this.base(viewer, "manualseggui");

        this.nodeclass = "ocrlab.SegmentPageManual";
        this._coords = [];
        this.registerListener("onCanvasChanged");
        this._node = null;

        this._colors = [
            ["#FFBBBB", "#FF8888"],
            ["#BBFFBB", "#88FF88"],
            ["#BBBBFF", "#8888FF"],
            ["#9966CC", "#9900CC"],
            ["#FFFF88", "#FFFF66"],
            ["#66BB00", "#339900"],
            ["#F7BE81", "#B45F04"],
            ["#D0A9F5", "#5F04B4"],
            ["#A9F5F2", "#088A85"],
        ];
        this._rects = [];
        this._css = {
            borderWidth: 1,
            borderStyle: "solid",                    
            zIndex: 201,
            opacity: 0.3,
        };
        this._paramre = /^\s*([-\d]+)\s*,\s*([-\d]+)\s*,\s*([-\d]+)\s*,\s*([-\d]+)\s*$/;
        this.setCanvasDraggable();        
    },

    readNodeData: function(node) {
        var self = this;                      
        var coords = []; 
        $.each(node.parameters, function(i, param) {
            if (param.name == "boxes") {
                console.debug("Parsing boxes...", param.value);
                var coordarray = param.value.split("~");
                $.each(coordarray, function(n, coordstr) {
                    var match = coordstr.match(self._paramre);
                    if (match) {
                        coords.push({
                            x0: parseInt(RegExp.$1),
                            y0: parseInt(RegExp.$2),
                            x1: parseInt(RegExp.$3),
                            y1: parseInt(RegExp.$4),
                        });
                    } else if ($.trim(coordstr) != "") {
                        console.error("Invalid box string:",  coordstr);
                    }
                });
            }
        });
        return coords;
    },                      

    sanitiseInputCoords: function(coords) {
        var fulldoc = this._viewer.activeViewer().source.dimensions;
        return {
            x0: Math.max(0, Math.min(fulldoc.x, coords.x0)),
            y0: Math.max(0, Math.min(fulldoc.y, coords.y0)),
            x1: (coords.x1 < 0 ? fulldoc.x : Math.min(fulldoc.x, coords.x1)),
            y1: (coords.y1 < 0 ? fulldoc.y : Math.min(fulldoc.y, coords.y1)),
        }
    },

    sanitiseOutputCoords: function(coords) {
        var fulldoc = this._viewer.activeViewer().source.dimensions;
        return {
            x0: Math.round(Math.max(-1, Math.min(coords.x0, fulldoc.x))),
            y0: Math.round(Math.max(-1, Math.min(coords.y0, fulldoc.y))),
            x1: Math.round(Math.max(-1, Math.min(coords.x1, fulldoc.x))),
            y1: Math.round(Math.max(-1, Math.min(coords.y1, fulldoc.y))),
        }
    },

    draggedRect: function(rect) {
        var self = this;
        this.addColumnBox(rect);
      //  console.log("Dragged rect, going to update node params", rect, this._rects);
      //  setTimeout(function() {
      //  $.each(self._rects, function(i, r) {
      //      console.log("Rect", $(r).offset().left, $(r).offset().top, $(r).width(), $(r).height());
      //  });
      //  }, 1000);
        console.log("Setting timeout when rects are", this._rects);
        //setTimeout(function() {
            self.updateNodeParameters();
        //}, 100);
    },

    addColumnBox: function(box) {
        var self = this;                      
        var css = {};
        $.extend(true, css, this._css);
        var colorindex = this._rects.length;
        if (colorindex > this._colors.length - 1)
            colorindex = 0;
        $.extend(css, {
            backgroundColor: this._colors[colorindex][0],
            borderColor: this._colors[colorindex][1],
        });

        var rect = this.addTransformableRect(box, css, function(elem, newpos) {            
            var obj = self.getRectObjectFromElement(elem);
            console.log("Updating", obj.order, newpos.x0);
            obj.box = newpos;
            self.updateNodeParameters();
        });

        rect.append(
            $("<div></div>")
                .addClass("layout_rect_label")
                .text(this._rects.length + 1));
        // bind the key handlers for changing the reading order
        rect.bind("mouseenter", function(enterevent) {
            $(window).bind("keydown.mousehandle", function(event) {
                if (event.keyCode >= KC_ONE && event.keyCode <= KC_NINE)
                    self.setRectOrder(rect, event.keyCode - KC_ZERO);
                else if (event.which == KC_DELETE) {
                    $(window).unbind("keydown.mousehandle");
                    self.deleteRect(rect);
                }
            });
        }).bind("mouseleave", function(leaveevent) {
            $(window).unbind("keydown.mousehandle");
        });
        this._rects.push({
            elem: rect,
            box: box,
            order: this._rects.length - 1,
        });
        //console.debug("Added column rect", box);
    },

    getRectObjectFromElement: function(elem) {
        for (var i in this._rects) {
            if (this._rects[i].elem === elem)
                return elem;
        }
    },                       

    sortRectsByOrder: function() {
        this._rects.sort(function(a, b) {
            return a.order - b.order;
        });
    },                   

    setRectOrder: function(elem, num) {
        var obj = this.getRectObjectFromElement(elem);
        if (num > this._rects.length)
            return;            
        var curr = obj.order;                       
        for (var i in this._rects) {
            if (this._rects[i].elem !== elem &&
                    this._rects[i].order == num) {
                this._rects[i].order = curr;
                $(".layout_rect_label", this._rects[i].elem).text(curr);
            }
        }
        $(".layout_rect_label", elem).text(num);
        obj.order = num;
        this.sortRectsByOrder();
        this.updateNodeParameters();
    },

    deleteRect: function(elem) {
        var obj = this.getRectObjectFromElement(elem);
        var pos = $.inArray(obj, this._rects);
        console.assert(pos > -1, "Attempt to delete untracked rect", elem, this._rects);
        this._rects.splice(pos, 1);        
        var next = obj.order;
        for (var i in this._rects) {
            if (this._rects[i].order > next) {
                this._rects[i].order = next;
                $(".layout_rect_label", this._rects[i].elem).text(next);
                next++;
            }
        }            
        this.removeTransformableRect(obj.elem);
        this.sortRectsByOrder();
        this.updateNodeParameters();
    },                    

    setup: function(node) {
        if (this._node)
            return;        
        this.base();
        var self = this;
        this._node = node;        
        console.log("Setting up manual seg GUI");
        var rects = this.readNodeData(node);

        $.each(rects, function(i, box) {
            self.addColumnBox(box);
        });
    },

    updateElement: function(element, src) {
        this.super(element, src);
        var obj = this.getRectObjectFromElement(element);
        obj.box = src;
        console.log("Updating node params!");
        this.updateNodeParameters();
    },                       

    update: function() {
        var node = this._node;
        this.tearDown();
        this.setup(node);
    },                

    tearDown: function() {
        this.base();                   
        console.log("Tearing down manual seg gui");                  
        for (var i in this._rects)
            this.removeTransformableRect(this._rects[i].elem);
        this._rects = [];
        this._node = null;              
    },

    setupEvents: function() {
        var self = this;                     
        this.base();
    },

    updateNodeParameters: function() {
        var self = this;        
        var rects = [];
        console.log("Updating rects", this._rects);
        $.each(this._rects, function(i, rect) {
            var out = self.sanitiseOutputCoords(rect.box);
            rects.push([out.x0, out.y0, out.x1, out.y1].join(","));
        });
     //   console.log("Updating rects", rects.join("~"));
        this.callListeners("parametersSet", this._node, {
            boxes: rects.join("~")
        });
    },                             
});
