// Undo stack

if (OCRJS === undefined) {
    OCRJS = {};
}


OCRJS.UndoStack = Base.extend({
    constructor: function(context) {
        this.__stack = [];
        this.index = 0;
        this.__context = context;
        this.__nocomp = false;
    },

    clear: function() {
        this.index = 0;
        this.__stack = [];
    },

    push: function(cmd) {
        while (this.__stack.length > this.index) {
            this.__stack.pop();
        }
        cmd.redo.call(this.__context);
        var merged = false;
        if (this.__stack.length && !this.__nocomp) {
            var prev = this.__stack[this.__stack.length - 1];
            if (prev.text == cmd.text) {
                if (cmd.mergeWith(prev)) {
                    merged = true;    
                }
            }
        }
        if (merged) {
            this.__stack[this.__stack.length - 1] = cmd;
        } else {
            this.__stack.push(cmd);
            this.index++;
            this.__nocomp = false;
        }
    },

    undoText: function() {
        if (this.__stack.length) {
            return "Undo " + this.__stack[this.index - 1].text();
        }
        return "Nothing to undo";
    },    

    redoText: function() {
        if (this.__stack.length && this.index < this.__stack.length) {
            return "Redo " + this.__stack[this.index].text();
        }
        return "Nothing to redo";
    },    

    undo: function() {
        if (!this.canUndo())
            return;
        this.__stack[this.index - 1].undo.call(this.__context);    
        this.index--;
    },

    redo: function() {
        if (!this.canRedo())
            return;
        this.index++;
        this.__stack[this.index - 1].redo.call(this.__context);
    },

    canUndo: function() {
        return this.index > 0;    
    },

    canRedo: function() {
        return this.__stack.length > this.index;
    },

    breakCompression: function() {
        this.__nocomp = true;
    }             
});

