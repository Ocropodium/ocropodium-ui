// 
// Page widget for viewing one-shot OCR conversions...
//

var OcrJs = OcrJs || {};

OcrJs.HocrViewer = OcrJs.TextViewer.extend({
    constructor: function(parent, options) {
        this.base(parent, options);                     
    },

    setData: function(results) {
        var self = this;
        self._div.html(results);
    },
});

