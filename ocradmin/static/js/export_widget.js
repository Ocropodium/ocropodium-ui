// Widget representing a single OCR batch.  Displays a lazy
// loading scrollable list of tasks which can be filtered 
// and individually restarted/aborted.


OcrJs.ExportWidget = OcrJs.BatchWidget.extend({
    init: function(parent, batch_id, initial, options) {
        this._super(parent, batch_id, initial, options);
        this._batchclass = "fedora";
        this._viewurl = null;
        this._viewtext = "View Objects";
        this._exporturl = null;
    },
});

