//
// Mixin class for nodetree elements


var OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};


OCRJS.Nodetree.SvgHelper = OCRJS.OcrBase.extend({
    constructor: function() {
        this.base();                 
    },
    translatere: /translate\(([-\d\.]+)(\s*,\s*([-\d\.]+))?\)/,
    scalere: /scale\(([-\d\.]+)(\s*,\s*([-\d\.]+)\))?/,

    updateScale: function(element, scale) {
        var trans = this.getTranslate(element);
        this.updateTransform(element, trans.x, trans.y, scale);
    },

    updateTranslate: function(element, x, y) {
        this.updateTransform(element, x, y, this.getScale(element));
    },

    updateTransform: function(element, tx, ty, scale) {
        // slightly more efficent method where we can just set the 
        // scale and transform outright without parsing for
        // existing values.
        // Assumes there's no rotation!
        var str = "translate(" + (tx).toFixed(2) + ","
                + (ty).toFixed(2) + ") scale("
                + (scale).toFixed(2) + "," + (scale).toFixed(2) + ")";
        $(element).attr("transform", str);
        
    },                         

    getTranslate: function(element) {
        var trans = {x: 0, y: 0},
            tattr = $(element).attr("transform"),
            tparse = tattr ? tattr.match(this.translatere) : null;
        if (tparse) {
            trans = {
                x: parseInt(tparse[1]),
                y: tparse[3] !== undefined
                    ? parseInt(tparse[3])
                    : parseInt(tparse[1]),
            };
        }
        return trans;
    },

    getScale: function(element) {
        // N.B: Ignore                  
        var tattr = $(element).attr("transform"),
            tparse = tattr ? tattr.match(this.scalere) : null;
        if (!tparse)
            return 1;
        return parseFloat(tparse[1]);
    },

    multPoints: function(p1, p2) {
        return { x: p1.x * p2.x, y: p1.y * p2.y};
    },              

    divPoints: function(p1, p2) {
        return { x: p1.x / p2.x, y: p1.y / p2.y};
    },              

    mouseCoord: function(parent, event) {
        var off = $(parent).offset();
        return {
            x: event.pageX - off.left,
            y: event.pageY - off.top,
        };
    },

    centrePointOfCircle: function(e) {
        return {
            x: parseInt($(e).attr("cx")),
            y: parseInt($(e).attr("cy")),
        };
    },

    norm: function(abs, element, stop) {
        // get the position of the mouse relative to a 
        // transformed element.  FIXME: This is HORRIBLY
        // inefficient and stupid. 
        var parent = element.parentNode;
        var trans;
        while (parent && parent != stop && parent.nodeName == "g") {
            trans = this.getTranslate(parent);
            scale = this.getScale(parent);
            abs.x -= (trans.x * scale);
            abs.y -= (trans.y * scale);
            parent = parent.parentNode;
        }
        return abs;
    },

    denorm: function(abs, element, stop) {
        // get the position of the mouse relative to a 
        // transformed element.  FIXME: This is HORRIBLY
        // inefficient and stupid. 
        var parent = element.parentNode;
        var trans;
        while (parent && parent != stop && parent.nodeName == "g") {
            trans = this.getTranslate(parent);
            scale = this.getScale(parent);
            abs.x += (trans.x / scale);
            abs.y += (trans.y / scale);
            parent = parent.parentNode;
        }
        return abs;
    },

    rectFromPoints: function(p1, p2) {
        // get a normalised rect from two points                        
        var x, y, width, height;                        
        if (p1.x < p2.x) {
            x = p1.x, width = p2.x - p1.x;    
        } else {
            x = p2.x, width = p1.x - p2.x;
        }
        if (p1.y < p2.y) {
            y = p1.y, height = p2.y - p1.y;
        } else {
            y = p2.y, height = p1.y - p2.y;
        }
        return { x: x, y: y, width: width, height: height};
    },

    rectsOverlap: function(r1, r2) {
        // does rect 2 overlap rect 1
        
        return ov =  r1.x < (r2.x + r2.width) && (r1.x + r1.width) > r2.x 
            && r1.y < (r2.y + r2.height) && (r1.y + r1.height) > r2.y;
    },                      
});
