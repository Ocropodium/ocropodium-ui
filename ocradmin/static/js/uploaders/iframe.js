// Upload files via an iframe.  Currently only allows one file to
// be uploaded at once, but works on all browsers.  Also a total
// pain to debug, since JS errors disappear into the iframe ether.


OcrJs.IframeUploader = OcrJs.AjaxUploader.extend({
    init: function(target, url, options) {
        this._super();
        this.url = url;
        $.extend(this.options, options);


    },


    

    
});

