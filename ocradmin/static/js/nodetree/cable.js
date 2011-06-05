//
// Class representing a cable between two nodes
//

OCRJS.Nodetree.BaseCable = OCRJS.Nodetree.Base.extend({
    constructor: function() {
        this.base();
        this._listeners = {
            cableRemoved: [],
        };
    },

    update: function(p1, p2) {                     
        $(this._path).attr("d", this.getPath(p1, p2).path());
    },

    getPath: function(p1, p2) {
        // get the cable arc between two points...                      
        var path = this.svg.createPath();
        var mp = {
            x: p1.x > p2.x ? p1.x + ((p2.x - p1.x) / 2) : p2.x + ((p1.x - p2.x) / 2),
            y: p1.y > p2.y ? p1.y + ((p2.y - p1.y) / 2) : p2.y + ((p1.y - p2.y) / 2),},
            radx = Math.abs(p1.x - p2.x),
            rady = Math.abs(p1.y - p2.y);
        return path.move(p1.x, p1.y)
                .arc(radx, rady, 0, false, p1.x > p2.x, mp.x, mp.y)
                .arc(radx, rady, 0, false, p1.x < p2.x, p2.x, p2.y);
    },

    remove: function() {
        this.svg.remove(this._group);
        this.callListeners("cableRemoved");
    },                
});

OCRJS.Nodetree.Cable = OCRJS.Nodetree.BaseCable.extend({
    constructor: function(startplug, endplug) {
        this.base();
        this.start = startplug;
        this.end = endplug;
        this.start.attach(this);
        this.end.attach(this);
    },

    setupEvents: function() {
        var self = this;
        //self.start.addListener("moved", function() {
        //    self.updateOnMove();
        //});
        //self.end.addListener("moved", function() {
        //    self.updateOnMove();
        //});
        $(self._hpath).hover(function(event) {
            self.svg.change(self._path, {fill: "#333"}); 
        }, function(event) {
            self.svg.change(self._path, {fill: "#999"}); 
        });
        $(self._hpath).click(function(event) {
            console.log("clicked!");
        });
    },

    //updateOnMove: function() {                      
    //    var m1 = this.denorm(this.start.centre(), this.start.group(), this.group());
    //    var m2 = this.denorm(this.end.centre(), this.end.group(), this.group());
    //    this.update(m1, m2);            
    //},

    draw: function(svg, parent, p1, p2) {
        this.svg = svg;        
        this._group = svg.group(parent, "cable_" + this.start.name + "_" + this.end.name);      
        this._hpath = this.svg.path(this._group, this.getPath(p1, p2), {
            fill: "transparent", stroke: "transparent", strokeWidth: 3,
        });
        this._path = this.svg.path(this._group, this.getPath(p1, p2), {
            fill: "transparent", stroke: "#666", strokeWidth: 1,
        });
        this.setupEvents();
    },

    update: function(p1, p2) {
        $(this._hpath).attr("d", this.getPath(p1, p2).path());
        $(this._path).attr("d", this.getPath(p1, p2).path());
    },                
});    


OCRJS.Nodetree.DragCable = OCRJS.Nodetree.BaseCable.extend({
    constructor: function(startplug) {
        this.base()                     
        this.start = startplug;
    },                     

    draw: function(svg, parent, p1, p2) {
        var self = this;
        this.svg = svg;        
              
        this._group = svg.group(parent);      
        this._path = this.svg.path(this._group, this.getPath(p1, p2), {
            fill: "transparent", stroke: "black", strokeWidth: 1,
            strokeDashArray: "2,2",
        });
    },              
});


