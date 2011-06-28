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


    // Horrid function to try and position lines how they would be on
    // the source material.  TODO: Make this not suck.
    columnLayout: function(pagediv) {
        var self = this;                      
        var pagebox = this.parseBbox($(".ocr_page", pagediv).first());
        var textbox = this._getTextBbox(pagediv, pagebox);    
        console.log(textbox);                

        console.log(pagediv.width());
        var scalefactor = pagediv.width() / (textbox[3] - textbox[1]);

        // expand the text box a bit
        textbox[0] = Math.min(0, textbox[0] - 50); 
        textbox[1] = Math.min(0, textbox[1] - 50); 
        textbox[2] = Math.min(pagebox[2], textbox[2] + 50); 
        textbox[3] = Math.min(pagebox[3], textbox[3] + 50);

        
        // now stick a position attribute on everything
        var linebox;
        $(".ocr_line", pagediv).each(function(i, elem) {
            var linebox = self.parseBbox($(elem));
            var x = (linebox[0] - textbox[0]) * scalefactor;
            var y = (linebox[1] - textbox[1]) * scalefactor;
            var w = (linebox[2] - linebox[0]) * scalefactor;
            var h = (linebox[3] - linebox[1]) * scalefactor;
            $(elem).css({
                position: "absolute",
                left: x,
                top: y
            });
            self._resizeToTarget($(elem), w, h);
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

    _resetState: function(pagediv) {
        $("span", pagediv).map(function(i, elem) {
            if ($.trim($(elem).text()) == "" || $.trim($(elem).text()) == "\u00a0") 
                return $(elem);
        }).remove();
        pagediv.find("br").remove();
        pagediv.removeClass("literal");
        pagediv.css("height", null);
        $(".ocr_line", pagediv).css("display", null);
    },


    _insertBreaks: function(pagediv) {
        var lastyh = -1;
        var lasth = -1;
        var lastitem;
        $(".ocr_line", pagediv).each(function(lnum, item) {
            var dims = $(item).data("bbox");
            var y = dims[1];  // bbox x, y, w, h
            var h = dims[3];
            if (dims[0] != -1) {
                $(item).attr("style", "");
                $(item).children("br").remove();
                if ((lastyh != -1 && lasth != -1) 
                        && (y - (h * 0.75) > lastyh || lasth < (h * 0.75))) {
                    $(lastitem).after($("<br />")).after($("<br />"));
                }
                lastitem = item;                
                lastyh = y + h;
                lasth = h;
            }                        
        });
    },

    _resizeToTarget: function(span, targetwidth, targetheight) {
        console.log("Resizing", span, targetwidth, targetheight);                         
        var iheight = span.height();
        var iwidth = span.width();
        var count = 0
        if (iheight < targetheight && iheight) {
            console.log("Enlarging", span, iheight, targetheight);
            //alert("grow! ih: " + iheight + " th: " + targetheight);
            while (iheight < targetheight && iwidth < targetwidth) {
                var cfs = parseInt(span.css("fontSize").replace("px", ""));
                span = span.css("fontSize", (cfs + 1));
                iheight = span.height();
                count++;
                if (count > 50) {
                    //alert("growing too long: iheight: " + iheight + " th: " + targetheight);
                    break;
                }
            }
        } else if (iheight > targetheight) {
            console.log("Shrinking", span);
            while (iheight && iheight > targetheight) {
                var cfs = parseInt(span.css("fontSize").replace("px", ""));
                span = span.css("fontSize", (cfs - 1));
                iheight = span.height();
                //alert("ih: " + iheight + " fs:" + cfs + " th: " + targetheight);
                //alert("iheight: " + iheight + " fs: " + span.css("font-size") + " cfs: " + (cfs - 1));
                count++;
                if (count > 50) {
                    //alert("shrinking too long: iheight: " + iheight + " th: " + targetheight);
                    break;
                }
            }
        }
        return span.css("fontSize");
    },
});
