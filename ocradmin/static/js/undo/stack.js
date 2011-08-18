// Undo stack

if (OCRJS === undefined) {
    OCRJS = {};
}


OCRJS.UndoStack = OCRJS.OcrBase.extend({
    constructor: function(context, options) {
        this.options = {
            levels: -1,
            compress: true,
        };
        $.extend(this.options, options);
        this._stack = [];
        this.index = 0;
        this._context = context;
        this._nocomp = false;
        this._macros = [];

        this._listeners = {
            indexChanged: [],
            undoStateChanged: [],
            redoStateChanged: [],            
        };
    },

    clear: function() {
        this.index = 0;
        this._stack = [];
    },

    beginMacro: function(text) {
        this._macros.push(new OCRJS.UndoMacro(text));
    },

    endMacro: function() {
        if (this._macros.length == 0)
            throw "endMacro called without calling beginMacro";
        var macro = this._macros.pop();
        if (this._macros.length > 0) {
            if (macro.size() > 0)
                this._macros[this._macros.length - 1].push(macro);
        } else        
            this.push(macro);
    },                  

    push: function(cmd) {
        if (this._macros.length > 0) {
            this._macros[this._macros.length - 1].push(cmd);
            cmd.redo.call(this._context);
            return;
        } 

        while (this._stack.length > this.index) {
            this._stack.pop();
        }
        cmd.redo.call(this._context);
        var merged = false;
        if (this.options.compress && this._stack.length && !this._nocomp) {
            var prev = this._stack[this._stack.length - 1];
            merged = prev.text == cmd.text && cmd.mergeWith(prev);
        }
        if (merged) {
            this._stack[this._stack.length - 1] = cmd;
        } else {
            this._stack.push(cmd);
            this.index++;
            this._nocomp = false;
            this._compact();
            this.callListeners("indexChanged");
        }
    },

    undoText: function() {
        if (this.canUndo()) {
            return "Undo " + this._stack[this.index - 1].text;
        }
        return "Nothing to undo";
    },    

    redoText: function() {
        if (this.canRedo()) {
            return "Redo " + this._stack[this.index].text;
        }
        return "Nothing to redo";
    },    

    undo: function() {
        if (!this.canUndo())
            return;
        this._stack[this.index - 1].undo();    
        this.index--;
        this.callListeners("undoStateChanged");
    },

    redo: function() {
        if (!this.canRedo())
            return;
        this.index++;
        this._stack[this.index - 1].redo();
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
        return this._stack.length > this.index;
    },

    breakCompression: function() {
        this._nocomp = true;
    },

    debug: function() {
        for (var i in this._stack) {
            this._stack[i].debug(0, i == this.index - 1);
        }
    },

    _compact: function() {
        if (this.options.levels > 0) {
            while (this._stack.length > this.options.levels) {
                this._stack.shift();
                this.index--;
            }
        }
    }                
});

