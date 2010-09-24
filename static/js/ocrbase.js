
// Initialise OCRJS namespace
if (OCRJS === undefined) {
    var OCRJS = {};
}


OCRJS.OcrBase = Base.extend({
    constructor: function(options) {
        this.options = {
            log: false,
        }
        $.extend(this.options, options);        
    },

    _logger: function(text) {
        if (!this.options.log)
            return;            
        var log = $("#logwin");
        if (!log.length) {
            log = $("<span></span>").attr("id", "logwin");
            $("body").append(log);
        }
        log.text((new Date()).getTime() + ":   " + text);
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
        $(this.parent).closest(".widget");    
    },
});
