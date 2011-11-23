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

        this._listeners = {
            start: [],
            error: [],
            poll: [],
            done: [],
        };
    },

    run: function(url) {
        var self = this;

        this.cleanup();
        this.trigger("start");
        this._run(url);

    },

    cleanup: function() {
        if (this._timer !== null)
            clearTimeout(this._timer);
        this._runcount = 0;
    },

    postRun: function() {
    },

    repoll: function(url) {         
        var self = this;
        if (this._timer !== null)
            clearTimeout(this._timer);
        this._timer = setTimeout(function() {
            self._run(url);
        }, this._interval);
    },

    _run: function(url) {
        var self = this;
        this.trigger("poll", this._runcount);
        $.ajax({
            url: url,
            dataType: "json",
            error: OcrJs.ajaxErrorHandler,
            success: function(data) {
                if (data.error || (data.status && data.status == "ERROR")) {
                    self.trigger("error", data.error);
                } else if (data.status == "SUCCESS") {
                    self.trigger("done", data);
                } else if (!data && self._runcount >= 3) {
                    self.trigger("error", "No data returned from server after 3 tries.");
                } else if (!data && self._runcount < 3) {
                    self.repoll(url);
                    return;
                } else if (data.status == "PENDING") {
                    // otherwise, repoll using the Celery task id in `data`
                    self.repoll("/ocr/result/" + data.task_id + "/");
                    return;
                }          
                // this will only get run if we don't
                // re-poll on 'PENDING'          
                self.postRun();
            },
        });
        this._runcount++;
    },                 
});
