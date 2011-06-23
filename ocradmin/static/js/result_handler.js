//
// Handler an queue for Async node evaluation tasks.
// 

OCRJS = OCRJS || {};

OCRJS.ResultHandler = OCRJS.OcrBase.extend({
    constructor: function(parent) {
        this.base(parent);
        this.parent = parent;

        this._timer = null;

        this._listeners = {
            validationError: [],
            resultPending: [],
            resultDone: [],
            haveErrorForNode: [],
        };
        
        this._cache = {};

        this._nodetasks = {};
        this._tasknodes = {};
        this._nodedata = {};
        this._pending = null;
    },

    watchNode: function(nodename, data) {
        var self = this;
        this._nodetasks[nodename] = data.task_id;
        this._tasknodes[data.task_id] = nodename;
        this._nodedata[nodename] = data;
        this._pending = data.task_id;
        self.pollForResults();

        

    },

    runScript: function(nodename, script) {
        var self = this;                   
        $.ajax({
            url: "/presets/run",
            type: "POST",
            data: {
                script: JSON.stringify(script),
                node: nodename,
            },
            error: OCRJS.ajaxErrorHandler,            
            success: function(data) {
                if (data.status == "NOSCRIPT")
                    console.log("Server said 'Nothing to do'")
                else if (data.status == "VALIDATION") {
                    $.each(data.errors, function(name, error) {
                        self.callListeners("validationError", name, error);
                    });
                } else {
                    self.callListeners("resultPending");
                    self.watchNode(nodename, data);
                }
            },
        });
    },

    pollForResults: function() {
        var self = this;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        this._timer = setTimeout(function() {
            $.ajax({
                url: "/presets/results/" + self._pending,
                error: OCRJS.ajaxErrorHandler,
                success: function(ndata) {
                    $.each(ndata, function(i, data) {
                        if (data.status != "PENDING")
                            self._pending = null;
                        if (data.status == "SUCCESS") {
                            self.callListeners("resultDone", 
                                    self._tasknodes[data.task_id], data); 
                        } else if (data.status != "PENDING") {
                            console.log("Got status", data.status);
                        }
                    });
                    if (self._pending)
                        self.pollForResults();
                    else
                        self._timer = null;
                }
            });
        }, 200);        
    },

});


