// 
// Page widget for viewing one-shot OCR conversions...
//

var OcrJs = OcrJs || {};

OcrJs.HocrViewer = OcrJs.TextViewer.extend({
    init: function(parent, options) {
        this._super(parent, options);                     
    },

    setData: function(results) {
        var self = this;
        self._div.html(results);
    },
});

