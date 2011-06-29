// Object to hold various formatting functions that operate 
// on an .ocr_page div, containing .ocr_line spans.


OCRJS.LineFormatter = OCRJS.OcrBase.extend({
    constructor: function(options) {
        this.base();
        this.parseBbox = OCRJS.Hocr.parseBbox;
        this.parseIndex = OCRJS.Hocr.parseIndex;
    },

    // Fudgy function to insert line breaks (<br />) in places
    // where there are large gaps between lines.  Significantly
    // improves the look of a block of OCR'd text.
    blockLayout: function(pagediv) {
        $(".ocr_line", pagediv).attr("style", "");
    },

    columnLayout: function(pagediv) {
        var self = this;                      
        var margin = 50;
        var pagebox = this.parseBbox($(".ocr_page", pagediv).first());
        var textbox = this._getTextBbox(pagediv, pagebox);    
        var scalefactor = (pagediv.width() - (2 * margin)) / (textbox[2] - textbox[0]);
        var lineboxes = $(".ocr_line", pagediv).map(function(i, elem) {
            var linebox = self.parseBbox($(elem));
            return [[(linebox[0] - textbox[0]) * scalefactor,
                    (linebox[1] - textbox[1]) * scalefactor,
                    (linebox[2] - linebox[0]) * scalefactor,
                    (linebox[3] - linebox[1]) * scalefactor]];
        });
        var stats = new Stats($.map(lineboxes, function(b) {
            return b[3];
        }));
        // now stick a position attribute on everything
        $(".ocr_line", pagediv).each(function(i, elem) {
            $(elem).css({
                position: "absolute",
                left: lineboxes[i][0] + margin,
                top: lineboxes[i][1] + margin
            });
            var th = (lineboxes[i][3] / stats.median - 1) < 0.5
                ? stats.median
                : lineboxes[i][3];
            self._resizeToTarget($(elem), lineboxes[i][2], th);
        }); 
    },

    _getTextBbox: function(pagediv, pagebox) {
        var self = this;                      
        var minx0 = pagebox[2],
            miny0 = pagebox[3],
            minx1 = pagebox[0],
            miny1 = pagebox[1];

        var linebox;
        $(".ocr_line", pagediv).each(function(i, elem) {
            linebox = self.parseBbox($(elem));
            minx0 = Math.min(minx0, linebox[0]);
            miny0 = Math.min(miny0, linebox[1]);
            minx1 = Math.max(minx1, linebox[2]);
            miny1 = Math.max(miny1, linebox[3]);    
        });
        return [minx0, miny0, minx1, miny1];
    },                      

    _resizeToTarget: function(span, targetwidth, targetheight) {
        var iheight = span.height(),
            iwidth = span.width(),
            count = 0,
            cfs;
        if (iheight < targetheight && iheight) {
            while (iheight < targetheight && iwidth < targetwidth) {
                cfs = parseInt(span.css("fontSize").replace("px", ""));
                span = span.css("fontSize", (cfs + 1));
                iheight = span.height();
                iwidth = span.width();
                count++;
                if (count > 50)
                    break;
            }
        } else if (iheight > targetheight) {
            while (iheight && iheight > targetheight) {
                cfs = parseInt(span.css("fontSize").replace("px", ""));
                span = span.css("fontSize", (cfs - 1));
                iheight = span.height();
                count++;
                if (count > 50)
                    break;
            }
        }
    },
});
