// this wouldn't be necessary of the HOCR output included
// a page element with bbox attributes, but since they 
// generally don't, it is...
function findMaxBounds(pdiv) {
    var x = 100000000;
    var y = 100000000;
    var w = -1;
    var h = -1;
    pdiv.children(".ocr_line").each(function(position, item) {
            var parsebbox = new RegExp(/(\d+) (\d+) (\d+) (\d+)/);
        if (item.attributes["bbox"].value.match(parsebbox)) {
            var ix = parseInt(RegExp.$1);
            var iy = parseInt(RegExp.$2); 
            var iw = parseInt(RegExp.$3);
            var ih = parseInt(RegExp.$4);
            if (ix < x) x = ix;
            if (iy < y) y = iy;            
            if ((ix + iw) > w) w = (ix + iw);
            if ((iy + ih) > h) h = (iy + ih);
        }                
   });      
   return [x, y, w, h]                          
}        

function positionByBounds(pdiv, debug) {
    var dims  = findMaxBounds(pdiv);
    var scale = (pdiv.width()) / dims[2];
    var offx = pdiv.offset().left;
    var offy = pdiv.offset().top;
    pdiv.height(((dims[3] - dims[1]) * scale) + 20); 
    pdiv.children(".ocr_line").each(function(position, item) {
        var lspan = $(item);
        var parsebbox = new RegExp(/(\d+) (\d+) (\d+) (\d+)/);
        if (item.attributes["bbox"].value.match(parsebbox)) {
            var x = ((parseInt(RegExp.$1) - dims[0]) * scale) + offx + 20;
            var y = ((parseInt(RegExp.$2) - dims[1]) * scale) + offy + 20; 
            var w = (parseInt(RegExp.$3) * scale);
            var h = (parseInt(RegExp.$4) * scale);
            lspan.css("top",    y).css("left",   x).css("position", "absolute");
        }                
        var iheight = lspan.height();
        var iwidth = lspan.width();
        if (iheight < h && iwidth <= w && iheight) {
            while (iheight < h && iwidth < w) {
                var cfs = parseInt(lspan.css("font-size").replace("px", ""));
                lspan = lspan.css("font-size", (cfs + 1) + "px");
                iheight = lspan.height();
            }
            } else if (iheight > h) {
            while (iheight && iheight > h) {
                var cfs = parseInt(lspan.css("font-size").replace("px", ""));
                lspan = lspan.css("font-size", (cfs - 1) + "px");
                iheight = lspan.height();
            }
        }
    });       
}

function insertBreaks(pdiv) {
    var parsebbox = new RegExp(/(\d+) (\d+) (\d+) (\d+)/);
    var lastyh = -1;
    var lasth = -1;
    var lastitem;
    pdiv.children(".ocr_line").each(function(lnum, item) {
        if (item.attributes["bbox"].value.match(parsebbox)) {
            $(item).attr("style", "");
            var x = parseInt(RegExp.$1);
            var y = parseInt(RegExp.$2); 
            var w = parseInt(RegExp.$3);
            var h = parseInt(RegExp.$4);
            if (lnum > 20 && lnum < 25) {
                //alert("lastyh: " + lastyh + "  y: " + y + " h: " + h);    
            } 
            if ((lastyh != -1 && lasth != -1) && (y - (h * 0.75) > lastyh || lasth < (h * 0.75))) {
                $(lastitem).append($("<br />")).append($("<br />"));
            }
            lastitem = item;                
            lastyh = y + h;
            lasth = h;
        }                        
    });
}

