// 
// Class that handles polling long-running celery tasks.
// It expects a particular format in the JSON return
// value `data` from each Ajax call:
//
//   data == null   Try again, up to max 3 times
//   data.error :   Something has gone wrong, call error handler
//   data.status where:
//      SUCCESS :  Call the done handler
//      PENDING :  Continue polling
//      ERROR   :  Call error handler
//


var OcrJs = OcrJs || {};

OcrJs.TaskWatcher = OcrJs.Base.extend({
    init: function(interval) {
        
        this._interval = interval;
        this._timer = null;
        this._runcount = 0;
        this._abort = false;
        this._running = false;

        this._listeners = {
            start: [],
            error: [],
            poll: [],
            done: [],
        };
    },

    abort: function() {
        this._abort = true;
    },

    isPending: function() {
        return this._running;
    },

    // run an Ajax call with POST data `pdata` and
    // metadata `meta` to be returned with (eventual)
    // results.
    run: function(url, pdata, meta) {
        var self = this;

        this.cleanup();
        this.preRun();
        this.trigger("start", meta);
        this._run(url, pdata, meta);

    },

    cleanup: function() {
        if (this._timer !== null)
            clearTimeout(this._timer);
        this._runcount = 0;
        this._abort = false;
    },

    preRun: function() {
        this._running = true;
    },

    postRun: function() {
        this._running = false;
    },

    repoll: function(taskid, pdata, meta) {         
        var self = this;

        if (this._abort) {
            this.cleanup();
            self._run("/ocr/abort/" + taskid + "/", pdata, meta);
            return false;
        }

        if (this._timer !== null)
            clearTimeout(this._timer);
        this._timer = setTimeout(function() {
            self._run("/ocr/result/" + taskid + "/", pdata, meta);
        }, this._interval);
    },

    _run: function(url, pdata, meta) {
        var self = this;
        this.trigger("poll", this._runcount, meta);
        $.ajax({
            url: url,
            data: pdata,
            type: pdata ? "post" : "get",
            dataType: "json",
            error: OcrJs.ajaxErrorHandler,
            success: function(data) {
                console.log(data);
                if (data.error || (data.status && data.status == "ERROR")) {
                    self.trigger("error", data.error, meta);
                } else if (!data && self._runcount >= 3) {
                    self.trigger("error", "No data returned from server after 3 tries.", meta);
                } else if (!data && self._runcount < 3) {
                    self._timer = setTimeout(function() {
                        self._run(url, pdata, meta);
                    }, self._interval);
                    return;
                } else if (data.status == "PENDING") {
                    // otherwise, repoll using the Celery task id in `data`
                    self.repoll(data.task_id, pdata, meta);
                    return;
                } else {
                    self.trigger("done", data, meta);
                }          
                // this will only get run if we don't
                // re-poll on 'PENDING'          
                self.postRun();
            },
        });
        this._runcount++;
    },                 
});
