// 
// Page widget for viewing one-shot OCR conversions...
//

var OCRJS = OCRJS || {};

OCRJS.TextViewer = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(parent, options);

        this._div = $("<div></div>")
            .addClass("textcontainer")
            .css("height", "500px")
            .appendTo(parent);
    },

    clearData: function() {
        var self = this;
        self._div.html("");
        self._div.removeData();
    },

    setData: function(results) {
        var self = this;
        self.clearData();
        console.log("TEXT VIEWER DATA: ", results);
        self._div.data("bbox", results.box);
        var lspan = $("<span></span>")
            .addClass("ocr_line");
        $.each(results.lines, function(linenum, line) {
            var s = lspan.clone();
            s.data("bbox", line.box);
            s.data("num", line.line);
            s.text(line.text);
            self._div.append(s);
        });
    },
});

