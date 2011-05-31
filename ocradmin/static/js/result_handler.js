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
            resultDone: [],
            haveErrorForNode: [],
        };
        
        this._nodetasks = {};
        this._tasknodes = {};
        this._nodedata = {};
        this._pending = null;
    },

    watchNode: function(nodename, data) {
        var self = this;
        console.log("Nodename", nodename, "Data", data);
        this._nodetasks[nodename] = data.task_id;
        this._tasknodes[data.task_id] = nodename;
        this._nodedata[nodename] = data;
        this._pending = data.task_id;
        self.pollForResults();

        

    },

    pollForResults: function() {
        var self = this;
        console.log("Polling with", self._pending);
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        this._timer = setTimeout(function() {
            $.ajax({
                url: "/plugins/results/" + self._pending,
                success: function(ndata) {
                    $.each(ndata, function(i, data) {
                        console.log("Data: status", data["status"], "Data", data);
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


