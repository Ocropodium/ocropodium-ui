//
// Class representing a node in a nodetree script.
// Nothing to do with the server-side JS engine.
//


var OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};

var SvgHelper = SvgHelper || new OCRJS.Nodetree.SvgHelper;

OCRJS.Nodetree.Node = OCRJS.OcrBase.extend({
    constructor: function(name, classdata, id) {
        this.base();
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

        this._listeners = {
            toggleIgnored: [],
            toggleFocussed: [],
            toggleViewing: [],
            deleteInitiated: [],
            parameterSet: [],
            deleted: [],
            created: [],
        };

        // dynamically set up callbacks for when this node's parameters are 
        // updates via a third party
        for (var i in this.parameters) {
            this.registerListener("parameterUpdated_" + this.parameters[i].name);
        }    
    },

    hashValue: function() {
        // Not implemented on the tree view so
        // return a semi-pseudo-random number
        return (new Date()).getTime();
    },                   

    group: function() {
        return this._group;
    },

    setName: function(name) {
        this.name = name;
        this.elem.find(".nodename").text(name);
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

    buildElem: function() {
        var tmpl = $.template($("#nodeTreeTmpl"));
        this.elem = $.tmpl(tmpl, this);
        this.elem.data("nodedata", this);
        this.setupEvents();
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

    setupEvents: function() {
        var self = this;                     
        this.elem.find(".ignorebutton").click(function(event) {
            self.setIgnored(!self._ignored, true);
            event.stopPropagation();
            event.preventDefault();
        });

        this.elem.find(".viewingbutton").click(function(event) {
            self.setViewing(!self._viewing, true);
            event.stopPropagation();
            event.preventDefault();
        });

        this.elem.click(function(event) {
            if (!self._focussed)
                self.setFocussed(true, true);
            else if (event.shiftKey)
                self.setFocussed(false, true);
            event.stopPropagation();
            event.preventDefault();
        });
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

    setIgnored: function(ignored, emit) {
        this._ignored = Boolean(ignored);
        this._toggleIgnored(this._ignored);
        if (emit) 
            this.callListeners("toggleIgnored", this, this._ignored);
    },

    setViewing: function(viewing, emit) {
        this._viewing = Boolean(viewing);
        this._toggleViewing(this._viewing);
        if (emit) 
            this.callListeners("toggleViewing", this, this._viewing);
    },

    setFocussed: function(focus, emit) {
        this._focussed = Boolean(focus);
        this._toggleFocussed(this._focussed);
        if (emit) 
            this.callListeners("toggleFocussed");
    },

    setErrored: function(errored, msg) {
        this._error = errored ? msg : null;
        this._toggleErrored(errored, msg);
    },

    _toggleIgnored: function(bool) {
        this.elem.find(".ignorebutton").toggleClass("active", bool);
    },

    _toggleViewing: function(bool) {
        this.elem.find(".viewingbutton").toggleClass("active", bool);
    },                        

    _toggleFocussed: function(bool) {
        this.elem.toggleClass("current", bool);
    },

    _toggleErrored: function(bool) {
        this.elem.toggleClass("validation_error", bool);                    
        this.elem.attr("title", this.getToolTip());    
    },                       
});



OCRJS.Nodetree.TreeNode = OCRJS.Nodetree.Node.extend({
    constructor: function(name, classdata, id) {
        this.base(name, classdata, id);
        this._inplugs = [];
        this._outplug = null;
        this._dragging = false;

        var self = this;
        $.each([
            "inputAttached",
            "outputAttached",
            "aboutToMove",
            "dropped",
            "moving",
            "moved",
            "clicked",
            "rightClicked",
            "plugHoverIn",
            "plugHoverOut",
            "plugRightClicked",
            ], function(i, ename) {
            self.registerListener(ename);    
        });
        
    },

    // class-level dimension attributes
    width: 150,
    height: 30,

    input: function(i) {
        return this._inplugs[i];
    },

    inputs: function(i) {
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
        console.log("Intypes:", this.intypes);
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
            fill: "none",
            stroke: "transparent",
            strokeWidth: 0,
        });

        this._ignorebutton = svg.rect(
                g,
                x + this.width - (buttonwidth + strokewidth),
                y + strokewidth,
                buttonwidth, this.height - (2*strokewidth), 1, 1, {
            fill: "none",
            stroke: "transparent",
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
                fontSize: 11,
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
            self.setIgnored(!self._ignored, true);
            event.stopPropagation();
            event.preventDefault();
        });

        $(this._viewbutton).click(function(event) {
            if (self._dragging) {
                self._dragging = false;
                return false;
            }
            self.setViewing(!self._viewing, true);
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
        var gradient = bool ? "url(#IgnoreGradient)" : "none";
        this.svg.change(this._ignorebutton, {fill: gradient});        
    },

    _toggleViewing: function(bool) {
        var gradient = bool ? "url(#ViewingGradient)" : "none";
        this.svg.change(this._viewbutton, {fill: gradient});        
    },

    _toggleFocussed: function(bool) {
        var gradient = bool ? "url(#FocusGradient)" : "url(#NodeGradient)";
        this.svg.change(this._rect, {fill: gradient});        
    },

    _toggleErrored: function(bool) {
        var stroke = bool ? "#F99" : "#BBB";
        this.svg.change(this._rect, {stroke: stroke});
        this.svg.change(this._centre, {stroke: stroke});
        $(this._tooltip).text(this.getToolTip());            
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
                trans.x + ((moveevent.pageX - dragstart.x) / scale.x),
                trans.y + ((moveevent.pageY - dragstart.y) / scale.y),
                1,
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
