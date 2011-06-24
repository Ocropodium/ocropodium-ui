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
        self.clearData();
        self._div.data("bbox", results.bbox);
        var lspan = $("<span></span>")
            .addClass("ocr_line");
        $.each(results.lines, function(linenum, line) {
            var s = lspan.clone();
            s.data("bbox", line.bbox);
            s.data("num", line.line);
            s.text(line.text);
            self._div.append(s);
        });
    },
});

