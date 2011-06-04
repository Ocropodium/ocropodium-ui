//
// Class representing a plug on a node
//

OCRJS.Nodetree.Plug = OCRJS.Nodetree.Base.extend({
    constructor: function(node, name, type) {
        this.base();

        this.node = node;
        this.name = name;
        this.type = type; // input / output

        this._listeners = {
            wired: [],
            attachCable: [],
            moved: [],
        };
    },

    draw: function(svg, parent, x, y) {
        var self = this;
        self.svg = svg;
        self._group = svg.group(parent, self.name);                
        self._circle = svg.circle(self._group, x, y, 10, {
                fill: "#999",
                strokeWidth: 0.5,
            }
        );
        this.setupEvents();
    },        

    setupEvents: function() {
        var self = this;

        $(self._circle).bind("click.attachcable", function(event) {
            self.callListeners("attachCable", self);
            event.stopPropagation();
            event.preventDefault();
        }).hover(function(event) {
            self.svg.change(self._circle, {fill: "#99F"});    
        }, function(event) {
            self.svg.change(self._circle, {fill: "#999"});    
        });
    },

    centre: function() {
        return this.centrePointOfCircle(this._circle);
    },    
});


