// 
// Page widget for viewing one-shot OCR conversions...
//

var OcrJs = OcrJs || {};

OcrJs.PageWidget = OcrJs.BaseWidget.extend({
    constructor: function(parent, pagename, tid, options) {
        this.base(parent, options);
        this._tid = tid;
        this._pagename = pagename;
        this._done = false;
        this._container = $("<div></div>")
            .addClass("ocr_page_container")
            .attr("title", pagename);
        this._head = $("<div></div>")
            .addClass("ocr_page_header")
            .text(pagename)
            .appendTo(this._container);
        this._div = $("<div></div>")
            .addClass("ocr_page")
            .addClass("waiting")
            .attr("id", "ocr_page_" + tid)
            .appendTo(this._container);

        this._closelink = $("<a></a>")
            .addClass("close_link")
            .addClass("ui-icon ui-icon-close")
            .appendTo(this._head);

        var formats = {
            text: "Text",
            hocr: "HOCR",
            json: "JSON",
        };
        var dlbutton = $("<a></a>")
            .attr("target", "_blank")
            .addClass("result_link")
            .addClass("button");
        var self = this;
        $.each(formats, function(format, name) {
            self._head.append(
                dlbutton.clone()
                    .text(name)
                    .attr("href", "/ocr/results/" + tid + "/?format=" + format)                    
            );    
        });

        this.setupMouseEvents();
    },    

    init: function() {
        return this._container;
    },

    setupMouseEvents: function() {
        var self = this;
        this._closelink.click(function(event) {
            self.close();    
        });                
        this._container.hoverIntent(function(event) {
            $(this).find(".result_link, .close_link").show(200);
        }, function(event) {
            $(this).find(".result_link, .close_link").hide(200);
        });
    },

    setupKeyEvents: function() {

    },

    close: function() {
        this.onClose();
        this._container.remove();
    },

    id: function() {
        return this._tid;
    },

    pageName: function() {
        return this._pagename;
    },

    setWaiting: function(waiting) {
        this._div.toggleClass("waiting", waiting);
    },              

    setError: function(error, traceback) {
        this._div.removeClass("waiting")
            .addClass("error")
            .html("<h4>Error: " + error + "</h4>");        
        if (traceback) {
            this._div.append(
                $("<div></div>").addClass("traceback")
                    .append("<pre>" + traceback + "</pre>")                                
            );
        }
        this._setDone();        
    },

    setResults: function(results) {        
        this._div.data("bbox", results.box);
        var lspan = $("<span></span>")
            .addClass("ocr_line");
        var self = this;
        $.each(results.lines, function(linenum, line) {
            self._div.append(
                lspan.clone()
                .data("bbox", line.box)
                .data("num", line.line)
                .text(line.text));
        });
        this._div.removeClass("waiting");
        this._setDone();
    },                

    onLinesReady: function() {

    },

    onClose: function() {
        
    },                 

    _setDone: function() {
        this._done = true;
        this.onLinesReady();
    },                
});
