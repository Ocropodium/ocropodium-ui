//
// Class representing a plug on a node
//

OCRJS.Nodetree.BasePlug = OCRJS.OcrBase.extend({
    constructor: function(node, name, datatype) {
        this.base();

        this.node = node;
        this.name = name;
        this.dtype = datatype || "?";
        this._pw = 30;
        this._ph = 20;

        this._listeners = {
            wired: [],
            attachCable: [],
            moved: [],
            hoverIn: [],
            hoverOut: [],
            rightClicked: [],
        };        
    },

    group: function() {
        return this._group;
    },        

    draw: function(svg, parent, x, y) {
        var self = this;
        self.svg = svg;
        self._group = svg.group(parent, self.name);                
        self._rect = svg.rect(this._group, 
                x - (this._pw / 2), y - (this._ph / 2), this._pw, this._ph, 5, 5, {
            fill: this._gradient,
            stroke: "#BBB",
            strokeWidth: 1,
        });
    },

    drawDatatype_ndarray: function(parent, x, y) {
        var radius = this._ph / 4;                              
        var dtype = this.svg.circle(parent, x, y, radius, {
            fill: "#FFF",
            strokeWidth: 0.5,
            stroke: "#666",
        });
        var path = this.svg.createPath()
            .move(x, y)
            .horiz(radius, true)
            .arc(radius, radius, -90, false, false, x, y - radius)
            .vert(y + radius)
            .arc(radius, radius, 90, false, true, x - radius, y)
            .close();
        this.svg.path(parent, path.path(), {
            fill: "#666",
        }); 
        return dtype;
    },                             

    drawDatatype_HocrString: function(parent, x, y) {
        var radius = this._ph / 4;                              
        //this.svg.circle(parent, x, y, radius, {
        //    fill: "#F5F6CE",
        //    strokeWidth: 0.5,
        //    stroke: "#666",
        //});
        var dtype = this.svg.text(parent, x - 0.5, y + 0.5, "HOCR", {
                textAnchor: "middle",
                alignmentBaseline: "middle",
                fontSize: 6,
                fontStretch: "narrower",
                fontWeight: "bold",
            }
        );
    },                             

    drawDatatype_unicode: function(parent, x, y) {
        var radius = this._ph / 4;                              
        //this.svg.circle(parent, x, y, radius, {
        //    fill: "#FDFDFD",
        //    strokeWidth: 0.5,
        //    stroke: "#666",
        //});
        var dtype = this.svg.text(parent, x, y + 0.5, "TEXT", {
                textAnchor: "middle",
                alignmentBaseline: "middle",
                fontSize: 6,
                fontFamily: "Serif",
                fontStretch: "narrower",
                fontWeight: "bold",
            }
        );
    },                             

    drawDatatype_dict: function(parent, x, y) {
        var radius = this._ph / 4;                              
        var start = (y + 1) - radius;
        for (var i = 0; i < 3; i++) {
            this.svg.rect(parent, x - radius, start + (i * ((radius / 3) + 1)), radius * 2, radius / 3, 0, 0, {
                strokewidth: 0.25,
                stroke: "#888",
                fill: "#FFF",
            });
        } 
   },                             

    wouldAccept: function(other) {
        if (other == this)
            return false;
        if (other.type == this.type)
            return false;
        if (other.dtype != this.dtype)
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

        $(this._group).noContext().rightClick(function(event) {
            self.callListeners("rightClicked", event);
        });            

        $(this._group).bind("click.attachcable", function(event) {
            self.callListeners("attachCable", self);
            event.stopPropagation();
            event.preventDefault();
        }).hover(function(event) {
            self.callListeners("hoverIn", self);
            //self.setAcceptingState(); 
        }, function(event) {
            self.callListeners("hoverOut", self);
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

    isOutput: function() {
        return this.type == "output";
    },

    isInput: function() {
        return this.type == "input";
    },        
});


OCRJS.Nodetree.InPlug = OCRJS.Nodetree.BasePlug.extend({
    constructor: function(node, name, datatype) {
        this.base(node, name, datatype);
        this.type = "input";
        this._gradient = "url(#InPlugGradient)";
        this._cable = null;
    },

    toString: function() {
        return "<InPlug: " + this.name + ">";
    },                  

    attach: function(cable) {
        if (this._cable)
            this._cable.remove();
        this._cable = cable;
    },

    detach: function() {
        if (this._cable)
            this._cable.remove();
        this._cable = null;
    },                
    
    cable: function() {
        return this._cable;
    },
    
    isAttached: function() {
        return Boolean(this._cable);
    },

    draw: function(svg, parent, x, y) {              
        this.base(svg, parent, x, y);
        var func = this["drawDatatype_" + this.dtype];
        if (func)
            this._label = func.call(this, this._group, x, y - (this._ph / 5));
        else {
            this._label = svg.text(this._group, x, y + (this._ph / 4), this.dtype, {
                    textAnchor: "middle",
                    alignmentBaseline: "middle",
                    fontSize: 7,
                }
            );
        }
        this.setupEvents();
    },        
});

OCRJS.Nodetree.OutPlug = OCRJS.Nodetree.BasePlug.extend({
    constructor: function(node, name, datatype) {
        this.base(node, name, datatype);
        this.type = "output";
        this._gradient = "url(#OutPlugGradient)";
    },

    toString: function() {
        return "<OutPlug: " + this.name + ">";
    },

    draw: function(svg, parent, x, y) {
        this.base(svg, parent, x, y);    

        var func = this["drawDatatype_" + this.dtype];
        if (func)
            this._label = func.call(this, this._group, x, y + (this._ph / 5));
        this.setupEvents();
    },
});

