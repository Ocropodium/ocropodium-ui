// Undo stack

if (OCRJS === undefined) {
    OCRJS = {};
}


OCRJS.UndoStack = OCRJS.OcrBase.extend({
    constructor: function(context) {
        this.__stack = [];
        this.index = 0;
        this.__context = context;
        this.__nocomp = false;
        this.__cancompress = true;
        this._currentmacro = null;        

        this._listeners = {
            indexChanged: [],
            undoStateChanged: [],
            redoStateChanged: [],            
        };
    },

    setCompressionEnabled: function(allow) {
        this.__cancompress = allow;
    },        

    clear: function() {
        this.index = 0;
        this.__stack = [];
    },

    beginMacro: function(text) {
        this._currentmacro = new OCRJS.UndoMacro(text);
    },

    endMacro: function() {
        if (!this._currentmacro)
            throw "endMacro called without calling beginMacro";
        var macro = this._currentmacro;
        this._currentmacro = null;        
        this.push(macro);
    },                  

    push: function(cmd) {
        if (this._currentmacro) {
            this._currentmacro.push(cmd);
            cmd.redo.call(this.__context);
            return;
        } 

        while (this.__stack.length > this.index) {
            this.__stack.pop();
        }
        cmd.redo.call(this.__context);
        var merged = false;
        if (this.__cancompress && this.__stack.length && !this.__nocomp) {
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
            this.callListeners("indexChanged");
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
        if (this._currentmacro)
            return false;            
        return this.index > 0;    
    },

    canRedo: function() {
        if (this._currentmacro)
            return false;            
        return this.__stack.length > this.index;
    },

    breakCompression: function() {
        this.__nocomp = true;
    }             
});

