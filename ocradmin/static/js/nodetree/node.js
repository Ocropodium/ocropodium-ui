//
// Class representing a node in a nodetree script.
// Nothing to do with the server-side JS engine.
//


var OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};

var SvgHelper = SvgHelper || new OCRJS.Nodetree.SvgHelper;

OCRJS.Nodetree.Node = OCRJS.OcrBase.extend({
    constructor: function(name, classdata, id) {
        this.base(name, classdata, id);
        this.name = name;
        this.type = classdata.name;
        this.arity = classdata.arity;
        this.description = classdata.description;
        this.stage = classdata.stage;
        this.intypes = classdata.intypes;
        this.outtype = classdata.outtype;
        this.passthough = classdata.passthrough;
        this.parameters = $.extend(true, [], classdata.parameters);
        this._ignored = false;
        this._focussed = false;
        this._viewing = false;
        this._id = id;
        this._error = null;
        this._inplugs = [];
        this._outplug = null;
        this._dragging = false;

        this._listeners = {
            toggleIgnored: [],
            toggleFocussed: [],
            toggleViewing: [],
            deleteInitiated: [],
            parameterSet: [],
            deleted: [],
            created: [],
            inputAttached: [],
            outputAttached: [],
            aboutToMove: [],
            dropped: [],
            moving: [],
            moved: [],
            clicked: [],
            rightClicked: [],
            plugHoverIn: [],
            plugHoverOut: [],
            plugRightClicked: [],
        };

        this._setBaseGradient(this._focussed);

        // dynamically set up callbacks for when this node's parameters are 
        // updates via a third party
        for (var i in this.parameters) {
            this.registerListener("parameterUpdated_" + this.parameters[i].name);
        }    
    },

    // class-level dimension attributes
    width: 150,
    height: 30,

    group: function() {
        return this._group;
    },

    getParameter: function(name) {
        for(var i in this.parameters) {
            if (this.parameters[i].name == name)
                return this.parameters[i].value;
        }
        throw "Unknown node parameter: " + this.name + ": " + name;
    },                      

    setParameter: function(name, value, emit) {
        var set = false;                      
        for(var i in this.parameters) {
            if (this.parameters[i].name == name) {
                this.parameters[i].value = value;
                set = true;
                if (emit)
                    this.callListeners("parameterUpdated_"
                            + this.parameters[i].name, value);
                break;                
            }
        }            
        if (!set)
            throw "Attempt to set non-existent parameter on " 
                + node.name + ": '" + name + "' = '" + value + "'"; 
    },                      

    getToolTip: function() {
        var tip = this.name + "\n\n"
            + this.type;
        if (this.description && this.description != "")
            tip += "\n\n" + this.description + "\n";
        if (this._error && this._error != "")
            tip += "\n\nError: " + this._error;        
        return tip;
    },                    

    toString: function() {
        return "<Node: " + this.name + ">";
    },

    removeNode: function() {
        this.elem.remove();
        this.callListeners("deleted", this);
    },

    isIgnored: function() {
        return this._ignored;
    },

    isFocussed: function() {
        return this._focussed;
    },                    

    isViewing: function() {
        return this._viewing;
    },                    

    setIgnored: function(ignored) {
        this._ignored = Boolean(ignored);
        this._toggleIgnored(this._ignored);
    },

    setViewing: function(viewing) {
        this._viewing = Boolean(viewing);
        this._toggleViewing(this._viewing);
    },

    setFocussed: function(focus) {
        this._focussed = Boolean(focus);
        this._toggleFocussed(this._focussed);
    },

    setErrored: function(errored, msg) {
        this._error = errored ? msg : null;
        this._toggleErrored(errored, msg);
    },

    input: function(i) {
        return this._inplugs[i];
    },

    inputs: function() {
        return this._inplugs;
    },        

    output: function() {
        return this._outplug;
    },

    hashValue: function() {
        var inputs = this.getInputNodes();                   
        if (this.arity > 0 && this.isIgnored()) {
            if (inputs[this.passthrough])                
                return inputs[this.passthrough].hash_value()
            else
                return "";
        }
        return {
            name: this.name,
            params: this.parameters,
            ignored: this.isIgnored(),
            children: $.map(inputs, function(n) {
                if (n)
                    return n.hashValue();
            }),
        };
    },                   

    setupPlugListeners: function(plug) {
        var self = this;                            
        plug.addListeners({
            attachCable: function() {
                self.callListeners(plug.type + "Attached", plug);
            },
            hoverIn: function() {
                self.callListeners("plugHoverIn", plug);
            },
            rightClicked: function(event) {
                self.callListeners("plugRightClicked", plug, event);
            },
        });
    },                            

    draw: function(svg, parent, x, y) {
        var self = this;
        this.svg = svg;

        var buttonwidth = this.height / 2;

        var g = svg.group(parent, "rect" + this._id);
        this._group = g;
        // draw the plugs on each node.
        var plugx = this.width / (this.arity + 1);
        for (var p = 1; p <= this.arity; p++) {
            var plug = new OCRJS.Nodetree.InPlug(
                    this, this.name + "_input" + (p-1), this.intypes[p-1]);
            plug.draw(svg, g, x + (p*plugx), y - 1);
            this._inplugs.push(plug);
            this.setupPlugListeners(plug);
        }
        
        // draw the bottom plug            
        this._outplug = new OCRJS.Nodetree.OutPlug(
                this, this.name + "_output", this.outtype);
        this._outplug.draw(svg, g, x  + (this.width / 2), y + this.height + 1);
        this.setupPlugListeners(this._outplug);

        // draw the rects themselves...
        var strokewidth = 1;
        this._rect = svg.rect(g, x, y, this.width, this.height, 2, 2, {
            fill: "url(#NodeGradient)",
            stroke: "#BBB",
            strokeWidth: 1,
        });
        this._tooltip = svg.title(g, this.getToolTip());        
        this._viewbutton = svg.rect(
                g,
                x + strokewidth,
                y + strokewidth,
                buttonwidth, this.height - (2*strokewidth), 1, 1, {
            fill: "url(#NodeGradient)",
            stroke: "none",
            strokeWidth: 0,
        });

        this._ignorebutton = svg.rect(
                g,
                x + this.width - (buttonwidth + strokewidth),
                y + strokewidth,
                buttonwidth, this.height - (2*strokewidth), 1, 1, {
            fill: "url(#NodeGradient)",
            stroke: "none",
            strokeWidth: 0,            
        });         
        // add the dividers between button and body
        svg.line(g,
                x + buttonwidth + 1,
                y + 1,
                x + buttonwidth + 1,
                y + (this.height - 1), {
            stroke: "#BBB",
            strokeWidth: 1,
        });
        svg.line(g,
                (x + this.width) - (buttonwidth + 1),
                y + 1,
                (x + this.width) - (buttonwidth + 1),
                y + (this.height - 1), {
            stroke: "#BBB",
            strokeWidth: 1,
        });
        // add the text labels
        this._textlabel = svg.text(g, x + this.width / 2,
            y + this.height / 2, this.name, {
                textAnchor: "middle",
                alignmentBaseline: "middle",
                fontSize: 10,
            }
        );
        this.setupEvents();
    },

    setName: function(name) {
        this.name = name;
        $(this._textlabel).text(name);
    },                 

    setupEvents: function() {
        var self = this;                     
        $(this._ignorebutton).click(function(event) {
            if (self._dragging) {
                self._dragging = false;
                return false;
            }
            console.log("Got an IGNORE click");
            self.callListeners("toggleIgnored");
            event.stopPropagation();
            event.preventDefault();
        });
        $(this._viewbutton).click(function(event) {
            if (self._dragging) {
                self._dragging = false;
                return false;
            }
            self.callListeners("toggleViewing");
            event.stopPropagation();
            event.preventDefault();
        });

        $([this._rect, this._textlabel]).noContext().rightClick(function(event) {
            self.callListeners("rightClicked", event);
        });            

        $([this._rect, this._textlabel]).click(function(event) {
            event.stopPropagation();
            if (self._dragging) {
                self._dragging = false;
                return false;
            }
            self.callListeners("clicked", event);
            self.callListeners("toggleFocussed");
            event.stopPropagation();
            event.preventDefault();
        });

        $(this._textlabel).css({cursor: "default"});
        $(this._group).bind("mousedown", function(event) {
            if (event.button == 0) {
                self.move(event, this);
            }
            event.stopPropagation();
            event.preventDefault();
        });
    },

    getInputNodes: function() {
        var inputs = [];                       
        $.each(this._inplugs, function(i, plug) {
            if (!plug.isAttached()) {
                inputs.push(null);
            } else {
                var cable = plug.cable();
                console.assert(cable);
                var node = cable.start.node;
                console.assert(node);
                inputs.push(node);
            }
        });
        return inputs;
    },                       

    serialize: function() {
        var self = this;
        var inputs = [];
        $.each(this.getInputNodes(), function(i, node) {
            if (node)
                inputs.push(node.name);
        });
        var params = [];
        $.each(this.parameters, function(i, p) {
            params.push([p.name, p.value]);
        });

        var out = {
            type: this.type,
            stage: this.stage,
            inputs: inputs,                    
            params: params,
        };
        if (this.isIgnored()) {
            out["ignored"] = true;
        }
        out.__meta = SvgHelper.getTranslate(this.group());
        out.__meta.focussed = self.isFocussed();
        out.__meta.viewing = self.isViewing();
        return out;
    },

    deserialize: function(data) {
        var self = this;                     
        this.type = data.type;
        this.stage = data.stage;
        $.each(data.params, function(i, kv) {
            self.parameters[i].name = kv[0];
            self.parameters[i].value = kv[1];
        });
        this.setIgnored(data.ignored);
        if (data.__meta) {
            this.moveTo(data.__meta.x, data.__meta.y);
            this.setFocussed(data.__meta.focussed);
            this.setViewing(data.__meta.viewing);
        }
    },                     

    removeNode: function(skipcleanup) {
        for (var i in this._inplugs)
            this._inplugs[i].detach();
        this.svg.remove(this.group());
        if (!skipcleanup)
            this.callListeners("deleted", this);
    },

    getDefaultColour: function() {

    },                          

    _toggleIgnored: function(bool) {
        var gradient = bool ? "url(#IgnoreGradient)" : this._gradient;
        this.svg.change(this._ignorebutton, {fill: gradient});        
    },

    _toggleViewing: function(bool) {
        var gradient = bool ? "url(#ViewingGradient)" : this._gradient;
        this.svg.change(this._viewbutton, {fill: gradient});        
    },

    _toggleFocussed: function(bool) {
        this._setBaseGradient(bool);                         
        this.svg.change(this._rect, {fill: this._gradient});        
        if (!this.isIgnored())
            this.svg.change(this._ignorebutton, {fill: this._gradient});
        if (!this.isViewing())
            this.svg.change(this._viewbutton, {fill: this._gradient});
    },

    _toggleErrored: function(bool) {
        var stroke = bool ? "#F99" : "#BBB";
        this.svg.change(this._rect, {stroke: stroke});
        this.svg.change(this._centre, {stroke: stroke});
        $(this._tooltip).text(this.getToolTip());            
    },

    _setBaseGradient: function(focussed) {
        this._gradient = focussed ? "url(#FocusGradient)" : "url(#NodeGradient)";
    },

    x: function() {
        return SvgHelper.getTranslate(this.group()).x;
    },           

    y: function() {
        return SvgHelper.getTranslate(this.group()).y;
    },

    position: function() {
        return SvgHelper.getTranslate(this.group());
    },        

    move: function(event, element) {
        var self = this;
        var dragstart = {
            x: event.pageX,
            y: event.pageY,
        };
        self.callListeners("moving");
        var trans = SvgHelper.getTranslate(element);
        var scale = SvgHelper.getScale(element.parentNode);
        var moved = false;
        $(document).bind("mousemove.dragelem", function(moveevent) {
            moved = true;
            SvgHelper.updateTransform(
                self.group(),
                trans.x + ((moveevent.pageX - dragstart.x) / scale),
                trans.y + ((moveevent.pageY - dragstart.y) / scale),
                1
            );
            self._notifyMove();
        });
        $(document).bind("mouseup.dragelem", function(event) {
            if (moved)
                self._dragging = true;
            $(this).unbind(".dragelem");
            $(document).unbind(event);
            event.stopPropagation();
            event.preventDefault();
            self.callListeners("dropped");
        });
    },

    moveBy: function(x, y) {
        var trans = SvgHelper.getTranslate(this.group());
        SvgHelper.updateTranslate(this.group(), trans.x + x, trans.y + y);
        this._notifyMove();
    },                

    moveTo: function(x, y) {
        SvgHelper.updateTranslate(this.group(), x, y);
        this._notifyMove();
    },

    _notifyMove: function() {
        this.callListeners("moved");
        $.each(this._inplugs, function(i, plug) {
            plug.callListeners("moved");                
        });
        this._outplug.callListeners("moved");
    }                     
});
