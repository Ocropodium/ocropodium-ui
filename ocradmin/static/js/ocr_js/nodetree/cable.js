//
// Class representing a cable between two nodes
//

OcrJs.Nodetree.BaseCable = OcrJs.Base.extend({
    init: function() {
        this._super();
        this._listeners = {
            cableRemoved: [],
        };
    },

    group: function() {
        return this._group;
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
        this.trigger("cableRemoved");
    },                
});

OcrJs.Nodetree.Cable = OcrJs.Nodetree.BaseCable.extend({
    init: function(startplug, endplug) {
        this._super();
        this.start = startplug;
        this.end = endplug;
        // the input (end of cable) owns the cable
        this.end.attach(this);
    },

    setupEvents: function() {
        var self = this;
    },

    draw: function(svg, parent, p1, p2) {
        this.svg = svg;        
        this._group = svg.group(parent, "cable_" + this.start.name + "_" + this.end.name);      
        this._path = this.svg.path(this._group, this.getPath(p1, p2), {
            fill: "none", stroke: "#666", strokeWidth: 1,
        });
        this.setupEvents();
    },

    update: function(p1, p2) {
        $(this._path).attr("d", this.getPath(p1, p2).path());
    },                
});    


OcrJs.Nodetree.DragCable = OcrJs.Nodetree.BaseCable.extend({
    init: function(startplug) {
        this._super()                     
        this.start = startplug;
    },                     

    draw: function(svg, parent, p1, p2) {
        var self = this;
        this.svg = svg;        
              
        this._group = svg.group(parent);      
        this._path = this.svg.path(this._group, this.getPath(p1, p2), {
            fill: "none", stroke: "black", strokeWidth: 1,
            strokeDashArray: "2,2",
        });
    },              
});


