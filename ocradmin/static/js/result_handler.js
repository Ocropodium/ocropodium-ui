//
// Handler an queue for Async node evaluation tasks.
// 

OCRJS = OCRJS || {};

OCRJS.ResultHandler = OCRJS.OcrBase.extend({
    constructor: function(parent) {
        this.base(parent);
        this.parent = parent;

        this._listeners = {
        };
        
        this._tasks = {};
    },

    watchNode: function(nodename, data) {
        var self = this;

        if (!self._tasks[data.status])
            self._tasks[data.status] = {};
        var stat = self._tasks[data.status];            
        stat[data.node] = data;

        

    },
});


