//
// Misc functions for use with HOCR
//

var OCRJS = OCRJS || {};

OCRJS.Hocr = new function() {

    var bboxre = /bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
    var indexre = /(\d+)$/;

    this.parseBbox =  function(elem) {
        if (elem.attr("title").match(bboxre)) {
            return [parseInt(RegExp.$1), parseInt(RegExp.$2),
                parseInt(RegExp.$3), parseInt(RegExp.$4)];
        }        
        console.error("No BBox match:", elem);
        return [-1, -1, -1, -1];
    };

    this.parseIndex = function(elem) {
        if (elem.attr("id").match(indexre)) {
            return parseInt(RegExp.$1);
        }
        console.error("No Index match:", elem);
        return -1;
    };        
};
