
// Initialise OCRJS namespace
if (OCRJS === undefined) {
    var OCRJS = {};
}


OCRJS.OcrBase = Base.extend({
    constructor: function(options) {
        this._log = [];
        this.options = {
            log: false,
        }
        $.extend(this.options, options);        
    },

    _logger: function(text) {
        if (!this.options.log)
            return;
        this._log.push((new Date()).getTime() + ":  " + text);
        if (this._log.length > 5)
            this._log.shift();        
        var log = $("#logwin");
        if (!log.length) {
            log = $("<div></div>")
                .attr("id", "logwin");
                
            $("body").append(log);
        }
        log.html("");
        $.each(this._log, function(i, t) {
            log.append($("<div>" + t + "</div>"));
        });
    },             
});


// Base widget for OCR items.  Just provides
// logging window facilities
OCRJS.OcrBaseWidget = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(options);
        this.parent = parent;
        this.options = {
            log: false,
        }
        $.extend(this.options, options);        
    },

    containerWidget: function() {
        return $(this.parent).closest(".widget");    
    },
});
