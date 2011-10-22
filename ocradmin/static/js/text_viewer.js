// 
// Page widget for viewing one-shot OCR conversions...
//

var OcrJs = OcrJs || {};

OcrJs.TextViewer = OcrJs.Base.extend({
    init: function(parent, options) {
        this._super(parent, options);
        this._div = $("<div></div>")
            .addClass("textcontainer")
            .css("height", "500px")
            .appendTo(parent);
        this._fontsize = parseInt(this._div.css("fontSize").replace(/px$/, ""));
    },

    MIN_FONT_SIZE: 6,
    MAX_FONT_SIZE: 40,

    setFontSize: function(size) {
        size = Math.min(size, this.MAX_FONT_SIZE);
        this._fontsize = Math.max(size, this.MIN_FONT_SIZE);
        this._div.css("fontSize", this._fontsize);
    },

    increaseFontSize: function() {
        this._fontsize = Math.max(this._fontsize + 2, this.MIN_FONT_SIZE);
        this._div.css("fontSize", this._fontsize);
    },

    reduceFontSize: function() {
        this._fontsize = Math.min(this._fontsize - 2, this.MAX_FONT_SIZE);
        this._div.css("fontSize", this._fontsize);
    },

    container: function() {
        return this._div;
    },        

    clearData: function() {
        var self = this;
        self._div.html("");
        self._div.removeData();
    },

    setData: function(results) {
        var self = this;
        self.clearData();
        $("<pre></pre>")
            .text(results).appendTo(this._div);
    },
});

