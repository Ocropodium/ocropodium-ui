// Widget representing a single OCR batch.  Displays a lazy
// loading scrollable list of tasks which can be filtered 
// and individually restarted/aborted.


OcrJs.ComparisonWidget = OcrJs.BatchWidget.extend({
    init: function(parent, batch_id, initial, options) {
        this._super(parent, batch_id, initial, options);
        this._batchclass = "compare";
        this._viewurl = "/training/comparison/?batch=" + this._batch_id;
        this._viewtext = "View Comparison";
        this._exporturl = null;
    },
});


