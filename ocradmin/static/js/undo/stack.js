// Undo stack

if (OCRJS === undefined) {
    OCRJS = {};
}


OCRJS.UndoStack = OCRJS.OcrBase.extend({
    constructor: function(context) {
        this.__stack = [];
        this.index = 0;
        this._context = context;
        this._nocomp = false;
        this._cancompress = true;
        this._macros = [];

        this._listeners = {
            indexChanged: [],
            undoStateChanged: [],
            redoStateChanged: [],            
        };
    },

    setCompressionEnabled: function(allow) {
        this._cancompress = allow;
    },        

    clear: function() {
        this.index = 0;
        this.__stack = [];
    },

    beginMacro: function(text) {
        this._macros.push(new OCRJS.UndoMacro(text));
    },

    endMacro: function() {
        if (this._macros.length == 0)
            throw "endMacro called without calling beginMacro";
        var macro = this._macros.pop();
        if (this._macros.length > 0)
            this._macros[this._macros.length - 1].push(macro);
        else        
            this.push(macro);
    },                  

    push: function(cmd) {
        if (this._macros.length > 0) {
            this._macros[this._macros.length - 1].push(cmd);
            cmd.redo.call(this._context);
            return;
        } 

        while (this.__stack.length > this.index) {
            this.__stack.pop();
        }
        cmd.redo.call(this._context);
        var merged = false;
        if (this._cancompress && this.__stack.length && !this._nocomp) {
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
            this._nocomp = false;
            this.callListeners("indexChanged");
        }
    },

    undoText: function() {
        if (this.canUndo()) {
            return "Undo " + this.__stack[this.index - 1].text;
        }
        return "Nothing to undo";
    },    

    redoText: function() {
        if (this.canRedo()) {
            return "Redo " + this.__stack[this.index].text;
        }
        return "Nothing to redo";
    },    

    undo: function() {
        if (!this.canUndo())
            return;
        this.__stack[this.index - 1].undo();    
        this.index--;
        this.callListeners("undoStateChanged");
    },

    redo: function() {
        if (!this.canRedo())
            return;
        this.index++;
        this.__stack[this.index - 1].redo();
        this.callListeners("redoStateChanged");
    },

    canUndo: function() {
        if (this._macros.length)
            return false;            
        return this.index > 0;    
    },

    canRedo: function() {
        if (this._macros.length)
            return false;            
        return this.__stack.length > this.index;
    },

    breakCompression: function() {
        this._nocomp = true;
    }             
});

