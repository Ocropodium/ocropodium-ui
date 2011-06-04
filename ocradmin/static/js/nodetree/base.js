//
// Mixin class for nodetree elements


var OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};


OCRJS.Nodetree.Base = OCRJS.OcrBase.extend({
    constructor: function() {
                     
        this._parsetranslate = new RegExp('translate\\((-?\\d+)\\s*,\\s*(-?\\d+)\\)');
        this._translatere = /translate\(([-\d\.]+)\s*,\s*([-\d\.]+)\)/;
        this._scalere = /scale\(([-\d\.]+)\s*,\s*([-\d\.]+)\)/;

        this._group = null;
    },

    group: function() {
        return this._group;
    },        

    updateScale: function(element, cx, cy) {
        var sstr = " scale("  + cx + "," + cy + ")";
        var sattr = $(element).attr("transform");
        if (sattr && sattr.match(this._scalere)) 
            $(element).attr("transform", $.trim(sattr.replace(this._scalere, sstr)));
        else if (sattr)
            $(element).attr("transform", $.trim(sattr + sstr));
        else
            $(element).attr("transform", $.trim(sstr)); 
    },

    updateTranslate: function(element, x, y) {
        var sstr = " translate("  + x + "," + y + ")";
        var sattr = $(element).attr("transform");
        if (sattr && sattr.match(this._translatere))
            $(element).attr("transform", $.trim(sattr.replace(this._translatere, sstr)));
        else if (sattr)
            $(element).attr("transform", $.trim(sattr + sstr));
        else
            $(element).attr("transform", $.trim(sstr)); 
    },

    getTranslate: function(element) {
        var trans = {x: 0, y: 0},
            tattr = $(element).attr("transform"),
            tparse = tattr ? tattr.match(this._translatere) : null;
        if (tparse) {
            trans = {x: parseInt(RegExp.$1), y: parseInt(RegExp.$2)};
        }
        return trans;
    },

    getScale: function(element) {
        var trans = {x: 1, y: 1},
            tattr = $(element).attr("transform"),
            tparse = tattr ? tattr.match(this._scalere) : null;
        if (tparse) {
            trans = {x: parseFloat(RegExp.$1), y: parseFloat(RegExp.$2)};
        }
        return trans;
    },

    multPoints: function(p1, p2) {
        return { x: p1.x * p2.x, y: p1.y * p2.y};
    },              

    divPoints: function(p1, p2) {
        return { x: p1.x / p2.x, y: p1.y / p2.y};
    },              

    mouseCoord: function(event) {
        var off = $(this.parent).offset();
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
        while (parent != stop && parent.nodeName == "g") {
            trans = this.getTranslate(parent);
            scale = this.getScale(parent);
            abs.x -= (trans.x * scale.x);
            abs.y -= (trans.y * scale.y);
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
        while (parent != stop && parent.nodeName == "g") {
            trans = this.getTranslate(parent);
            scale = this.getScale(parent);
            abs.x += (trans.x / scale.x);
            abs.y += (trans.y / scale.y);
            parent = parent.parentNode;
        }
        return abs;
    },


});
