//
// Class representing a plug on a node
//

OCRJS.Nodetree.Plug = OCRJS.Nodetree.Base.extend({
    constructor: function(node, name, type) {
        this.base();

        this.node = node;
        this.name = name;
        this.type = type; // input / output

        this._pw = 30;
        this._ph = 20;

        this._listeners = {
            wired: [],
            attachCable: [],
            moved: [],
            hoverIn: [],
            hoverOut: [],
        };

        this._gradient = this.type == "input"
            ? "url(#InPlugGradient)"
            : "url(#OutPlugGradient)";
    },

    draw: function(svg, parent, x, y) {
        var self = this;
        self.svg = svg;
        self._group = svg.group(parent, self.name);                
        //self._circle = svg.circle(self._group, x, y, 10, {
        //        fill: "#999",
        //        strokeWidth: 0.5,
        //    }
        //);

        self._rect = svg.rect(parent, 
                x - (this._pw / 2), y - (this._ph / 2), this._pw, this._ph, 5, 5, {
            fill: this._gradient,
            stroke: "#BBB",
            strokeWidth: 1,
        });                        

        this.setupEvents();
    },

    wouldAccept: function(other) {
        if (other.type == this.type)
            return false;
        if (other == this)
            return false;
        if (other.node == this.node)
            return false;
        return true;
    },              

    setAcceptingState: function() {
        this.svg.change(this._rect, {fill: "url(#PlugAccept)"});
    },

    setRejectingState: function() {
        this.svg.change(this._rect, {fill: "url(#PlugReject)"});
    },

    setDefaultState: function() {
        this.svg.change(this._rect, {fill: this._gradient});
    },                         

    setDraggingState: function() {
        this._dragging = true;                          
        this.svg.change(this._rect, {fill: "url(#PlugDragging)"});
    },                         

    setupEvents: function() {
        var self = this;

        $(self._rect).bind("click.attachcable", function(event) {
            self.callListeners("attachCable", self);
            event.stopPropagation();
            event.preventDefault();
        }).hover(function(event) {
            self.callListeners("hoverIn");
            //self.setAcceptingState(); 
        }, function(event) {
            self.callListeners("hoverOut");
            self.setDefaultState();    
        });
    },

    centre: function() {
        //return this.centrePointOfCircle(this._circle);
        return {
            x: parseInt($(this._rect).attr("x")) + this._pw / 2,
            y: parseInt($(this._rect).attr("y")) + this._ph / 2,
        };
    },    
});


