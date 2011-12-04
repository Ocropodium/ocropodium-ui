//
// Misc functions for use with HOCR
//

var OcrJs = OcrJs || {};

OcrJs.Hocr = new function() {

    var bboxre = /bbox\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/;
    var indexre = /(\d+)$/;

    this.parseBbox =  function(elem) {
        if (elem.attr("title") && elem.attr("title").match(bboxre)) {
            return new DziViewer.Rect(parseInt(RegExp.$1), parseInt(RegExp.$2),
                parseInt(RegExp.$3), parseInt(RegExp.$4));
        }
        return new DziViewer.Rect(0,0,0,0);
    };

    this.parseIndex = function(elem) {
        if (elem.attr("id") && elem.attr("id").match(indexre)) {
            return parseInt(RegExp.$1);
        }
        return -1;
    };
};
