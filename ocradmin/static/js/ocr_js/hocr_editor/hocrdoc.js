// 
// Object abstraction for navigating an HOCR document
//

var OcrJs = OcrJs || {};
OcrJs.HocrEditor = OcrJs.HocrEditor || {};

var HE = OcrJs.HocrEditor;

HE.HocrDoc = OcrJs.Base.extend({
    init: function(xmldata) {
        this._super(parent);
        this._data = $(xmldata);

        this._cline = null;

        // convenience functions
        this.parseBbox = OcrJs.Hocr.parseBbox;
        this.parseIndex = OcrJs.Hocr.parseIndex;
    },

    reset: function() {
        this._cline = null;
    },

    /* 
     * Parse a string and return the last numeric
     * component.  In an HOCR id this will _usually_
     * be the order of the element amongst its equivilents.
     */
    _parseIdNumber: function(idstr) {
        if (idstr.search(/_(\d+)$/) != -1)
            return parseInt(RegExp.$1);
        else
            return null;
    },                        

    _replaceIdNumber: function(idstr, num) {
        if (idstr.search(/^(.+)_(\d+)$/) != -1)
            return RegExp.$1 + "_" + num;
        return idstr;
    },

    _firstOrLastElem: function(last) {
        var func = last ? "last" : "first";
        this._cline = this._data.find(".ocr_line")[func]().get(0);
        return this._cline;
    },

    _nextOrPrevElem: function(prev) {
        if (this._cline === null)
            return this.firstLine();
        else {
            var num = this._parseIdNumber(this._cline.id);
            var incnum = prev ? num - 1 : num + 1; 
            console.assert(num !== null, "Can't extract index from current line", this._cline);
            var newid = this._replaceIdNumber(this._cline.id, incnum);
            this._cline = document.getElementById(newid);
        }
        return this._cline;
    },

    setupEvents: function() {
        var self = this;
    },

    setCurrent: function(elem) {
        this._cline = elem;
    },

    setData: function(xmldata) {
        this._data = $(xmldata);
    },

    setCurrent: function(elem) {
        this._cline = elem;
    },

    /*
     * The following functions return HTML elements
     */

    nextLine: function() {
        return this._nextOrPrevElem(false);
    },

    prevLine: function() {
        return this._nextOrPrevElem(true);
    },

    firstLine: function() {
        return this._firstOrLastElem(false);
    },

    lastLine: function() {
        return this._firstOrLastElem(true);
    },

    lineCount: function() {
        return $(".ocr_line").length;
    },

    page: function() {

    },              
});

