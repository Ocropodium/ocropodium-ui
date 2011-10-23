// Undo command object

if (OcrJs === undefined) {
    var OcrJs = {};
}


OcrJs.UndoMacro = OcrJs.UndoCommand.extend({
    init: function(text, options) {
        this._super(text, options);                     
        this._stack = [];
        return this;
    },

    toString: function() {
        return "<UndoMacro: " + this.text + ">";
    },

    push: function(cmd) {
        this._stack.push(cmd);
    },

    undo: function() {                      
        for (var i = this._stack.length - 1; i > -1; i--) {
            console.log("Macro undo", this._stack[i].text);
            this._stack[i].undo(); 
        }
    },

    redo: function() {
        for (var i in this._stack) {
            this._stack[i].redo();
        }
    },

    size: function() {
        return this._stack.length;
    },              

    debug: function(indent, curr) {
        var pad = indent ? Array(indent + 1).join("\t") : "";               
        console.log((new Date).getTime() + (curr ? " --> " : "     ") + pad + " M " + this.text);
        for (var i in this._stack) {
            this._stack[i].debug(indent ? (indent + 1) : 1);
        }
    },               
});


