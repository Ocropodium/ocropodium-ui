//
// Class representing a cable between two nodes
//

OCRJS.Nodetree.Cable = OCRJS.Nodetree.Base.extend({
    constructor: function(startplug, endplug) {
        this.base();

        this.start = startplug;
        this.end = endplug;

        this._listeners = {
            cableRemoved: [],
        };
    },

    update: function(p1, p2) {                     
        // update the cable position... N.B. The cable is
        // parented to it's input
        var self = this;
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

    draw: function(svg, parent, p1, p2) {
        var self = this;
        self.svg = svg;        
        self._group = svg.group(parent);      
        self._path = self.svg.path(self._group, self.getPath(p1, p2), {
            fill: "transparent", stroke: "#666", strokeWidth: 1,
        });


    },

    remove: function() {
        this.svg.remove(this._group);
        this.callListeners("cableRemoved");
    },                
});


OCRJS.Nodetree.DragCable = OCRJS.Nodetree.Cable.extend({
    constructor: function(startplug) {
        this.base();

        this.plug = startplug;
    },                     


    draw: function(svg, parent, p1, p2) {
        var self = this;
        self.svg = svg;        
              
        self._group = svg.group(parent);      
        self._path = self.svg.path(self._group, self.getPath(p1, p2),
            { fill: "transparent", stroke: "black", strokeWidth: 1,
                strokeDashArray: "2,2",
            });

    },              

});


