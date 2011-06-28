// 
// Page widget for viewing one-shot OCR conversions...
//

var OCRJS = OCRJS || {};

OCRJS.HocrViewer = OCRJS.TextViewer.extend({
    constructor: function(parent, options) {
        this.base(parent, options);                     
    },

    setData: function(results) {
        var self = this;
        self._div.html(results);
    },
});

