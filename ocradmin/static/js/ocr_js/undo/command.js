// Undo command object

if (OcrJs === undefined) {
    var OcrJs = {};
}


OcrJs.UndoCommand = Base.extend({
    constructor: function(text, options) {
        this.text = text || "";
        $.extend(this, options);
        return this;
    },

    setText: function(text) {
        this.text = text || "";
        return this;
    },

    toString: function() {
        return "<UndoCommand: " + this.text + ">";
    },

    undo: function() {
        throw "Unimplemented undo: " + this.text;        
    },

    redo: function() {
        throw "Unimplemented redo: " + this.text;        
    },

    mergeWith: function(other) {
        // default implementation does nothing
        return false;
    },

    debug: function(indent, curr) {
        var pad = indent ? Array(indent + 1).join("  ") : "";               
        console.log((new Date).getTime() + (curr ? " --> " : "     ") + pad + " C " + this.text);
    },               
});

