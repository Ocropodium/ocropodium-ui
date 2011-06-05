//
// Class representing a node in a nodetree script.
// Nothing to do with the server-side JS engine.
//


var OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};


OCRJS.Nodetree.Node = OCRJS.Nodetree.Base.extend({
    constructor: function(name, classdata, id) {
        this.base();
        this.name = name;
        this.type = classdata.name;
        this.arity = classdata.arity;
        this.desc = classdata.description;
        this.stage = classdata.stage;
        this.parameters = $.extend(true, [], classdata.parameters);
        this._id = id;
        this._ignored = false;
        this._focussed = false;
        this._viewing = false;

        this._inplugs = [];
        this._outplug = null;

        this._listeners = {
            toggleIgnored: [],
            toggleFocussed: [],
            toggleViewing: [],
            deleted: [],
            created: [],
            inputAttached: [],
            outputAttached: [],
            moved: [],
            plugHoverIn: [],
            plugHoverOut: [],
        };
        
    },

    toString: function() {
        return "<Node: " + this.name + ">";
    },

    input: function(i) {
        return this._inplugs[i];
    },

    output: function() {
        return this._outplug;
    },                

    draw: function(svg, parent, x, y) {
        var self = this;
        self.svg = svg;
        var nodewidth = 150,
            nodeheight = 30,
            buttonwidth = 15;

        var g = svg.group(parent, "rect" + self._id);
        self._group = g;
        // draw the plugs on each node.
        var plugx = nodewidth / (self.arity + 1);

        for (var p = 1; p <= self.arity; p++) {
            var plug = new OCRJS.Nodetree.InPlug(self, self.name + "_input" + (p-1));
            plug.draw(svg, g, x + (p*plugx), y - 1);
            this._inplugs.push(plug);
            plug.addListener("attachCable", function(pl) {
                self.callListeners("inputAttached", pl);
            });
            plug.addListener("hoverIn", function(pl) {
                self.callListeners("plugHoverIn", pl);
            });
        }
        
        // draw the bottom plug            
        self._outplug = new OCRJS.Nodetree.OutPlug(self, self.name + "_output");
        self._outplug.draw(svg, g, x  + (nodewidth / 2), y + nodeheight + 1);
        self._outplug.addListener("attachCable", function(pl) {
            self.callListeners("outputAttached", pl);
        });
        self._outplug.addListener("hoverIn", function(pl) {
            self.callListeners("plugHoverIn", pl);
        });

        // draw the rects themselves...
        self._rect = svg.rect(g, x, y, nodewidth, nodeheight, 2, 2, {
            fill: "url(#NodeGradient)",
            stroke: "#BBB",
            strokeWidth: 1,
        });
        self._viewbutton = svg.rect(g, x, y, buttonwidth, nodeheight, 0, 0, {
            fill: "transparent",
            stroke: "#BBB",
            strokeWidth: 0.5,
        });         
        self._ignorebutton = svg.rect(g, x + nodewidth - buttonwidth, y, buttonwidth, nodeheight, 0, 0, {
            fill: "transparent",
            stroke: "#BBB",
            strokeWidth: 0.5,
        });         
        // add the labels
        self._textlabel = svg.text(g, x + nodewidth / 2,
            y + nodeheight / 2, self.name, {
                textAnchor: "middle",
                alignmentBaseline: "middle",
            }
        );
        self.setupEvents();
        return g;        
    },

    setupEvents: function() {
        var self = this;                     
        $(self._ignorebutton).click(function(event) {
            self.setIgnored(!self._ignored, true);
            event.stopPropagation();
            event.preventDefault();
        });

        $(self._viewbutton).click(function(event) {
            self.setViewing(!self._viewing, true);
            event.stopPropagation();
            event.preventDefault();
        });

        $(self._rect).click(function(event) {
            if (!self._focussed)
                self.setFocussed(true, true);
            event.stopPropagation();
            event.preventDefault();
        });
        $(self._group).bind("mousedown", function(event) {
            if (event.button == 0) {
                self.move(event, this);
            }
            event.stopPropagation();
            event.preventDefault();
        });
    },

    removeNode: function() {
        this.elem.remove();
        this.callListeners("deleted", this);
    },

    isIgnored: function() {
        return this._ignored;
    },

    setIgnored: function(ignored, emit) {
        this._ignored = typeof(ignored) === "undefined" ?  false : ignored;
        var gradient = this._ignored ? "url(#IgnoreGradient)" : "transparent";
        this.svg.change(this._ignorebutton, {fill: gradient});        
        if (emit) 
            this.callListeners("toggleIgnored", this, this._ignored);
    },

    setViewing: function(viewing, emit) {
        this._viewing = viewing || false;
        var gradient = this._viewing ? "url(#ViewingGradient)" : "transparent";
        this.svg.change(this._viewbutton, {fill: gradient});        
        if (emit) 
            this.callListeners("toggleViewing", this, this._viewing);
    },

    setFocussed: function(focus, emit) {
        this._focussed = focus || false;
        var gradient = this._focussed ? "url(#FocusGradient)" : "url(#NodeGradient)";
        this.svg.change(this._rect, {fill: gradient});        
        if (emit) 
            this.callListeners("toggleFocussed", this, this._focussed);
    },

    setErrored: function(errored, msg) {
        this.elem.toggleClass("validation_error", errored);                    
        this.elem.attr("title", errored ? msg : this.description);    
    },    

    move: function(event, element) {
        var self = this;
        var dragstart = {
            x: event.pageX,
            y: event.pageY,
        };
        var trans = self.getTranslate(element);
        var scale = self.getScale(element.parentNode);
        $(document).bind("mousemove.dragelem", function(moveevent) {
            self.moveTo(
                trans.x + ((moveevent.pageX - dragstart.x) / scale.x),
                trans.y + ((moveevent.pageY - dragstart.y) / scale.y));
        });
        $(document).bind("mouseup.unloaddrag", function(event) {
            $(this).unbind("mousemove.dragelem");
            $(document).unbind(event);
        });
    },

    moveTo: function(x, y) {
        var self = this;
        console.log(self.name, "moving to", x, y);        
        self.updateTranslate(self.group(), x, y);
        self.callListeners("moved");
        $.each(self._inplugs, function(i, plug) {
            plug.callListeners("moved");                
        });
        self._outplug.callListeners("moved");
    },                
});
