// Object to hold various formatting functions that operate 


OcrJs.LineFormatter = OcrJs.Base.extend({
    init: function(options) {
        this._super();
        this.parseBbox = OcrJs.Hocr.parseBbox;
        this.parseIndex = OcrJs.Hocr.parseIndex;
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
        var scalefactor = (pagediv.width() - (2 * margin)) / textbox.width;
        // fudge to account for a scroll bar
        if (pagebox.height * scalefactor > pagediv.height())
            margin -= 10;
        var lineboxes = $(".ocr_line", pagediv).map(function(i, elem) {
            var linebox = self.parseBbox($(elem));
            return [new DziViewer.Rect(
                    (linebox.x0 - textbox.x0) * scalefactor,
                    (linebox.y0 - textbox.y0) * scalefactor,
                    linebox.x1 * scalefactor,
                    linebox.y1 * scalefactor)
            ];
        });
        var stats = new Stats($.map(lineboxes, function(b) {
            return b.height;
        }));
        // now stick a position attribute on everything
        $(".ocr_line", pagediv).each(function(i, elem) {
            $(elem).css({
                position: "absolute",
                left: Math.round(lineboxes[i].x0) + margin,
                top: Math.round(lineboxes[i].y0) + margin
            });
            var th = (lineboxes[i].height / stats.median - 1) < 0.5
                ? stats.median
                : lineboxes[i].height;
            self._resizeToTarget($(elem), lineboxes[i].width, th);
        }); 
    },

    _getTextBbox: function(pagediv, pagebox) {
        var self = this;                      
        var minx0 = pagebox.x1,
            miny0 = pagebox.y1,
            minx1 = pagebox.x0,
            miny1 = pagebox.y0;

        var linebox;
        $(".ocr_line", pagediv).each(function(i, elem) {
            linebox = self.parseBbox($(elem));
            minx0 = Math.min(minx0, linebox.x0);
            miny0 = Math.min(miny0, linebox.y0);
            minx1 = Math.max(minx1, linebox.x1);
            miny1 = Math.max(miny1, linebox.y1);    
        });
        return new DziViewer.Rect(minx0, miny0, minx1, miny1);
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
            while (iheight && iheight > targetheight && iwidth < targetwidth) {
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
