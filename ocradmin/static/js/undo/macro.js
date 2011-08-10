// Undo command object

if (OCRJS === undefined) {
    var OCRJS = {};
}


OCRJS.UndoMacro = OCRJS.UndoCommand.extend({
    constructor: function(text, options) {
        this.base(text, options);                     
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
});


