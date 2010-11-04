// Upload files via Ajax File API.  This is currently only supported by Firefox,
// but it allows multiple files to be uploaded at once.


OCRJS.AjaxUploader = OCRJS.OcrBase.extend({
    constructor: function(target, url, options) {
        this.target = target;
        this.url = url;
        this.base();
        this.options = {
            log: true,      // whether to, uh, log
            multi: true,    // whether to accept multiple files
        };
        $.extend(this.options, options);

        this._maxsize = 0;
        this._queue = [];
        this._params = [];

        $(this.target).wrap($("<div></div>"));
        this._fakeinput = $("<input></input>")
            .attr("type", "file")
            .attr("id", "fakeinput")
            .attr("multiple", this.options.multi ? "multiple" : null)
            .width($(this.target).outerWidth())
            .height($(this.target).outerHeight())
            .css({
                position: "absolute",
                opacity: 0.0,                
                top: $(this.target).offset().top + "px",
                left: $(this.target).offset().left + "px",
            }).insertAfter(this.target);
        this._cnt = $(this.target).parent().get(0);
        
        this.setupEvents();
    },

    setupEvents: function() {
        var self = this;

        this._cnt.addEventListener("drop", function(event) {
            try {
                self.uploadPost(event.dataTransfer.files);            
            } catch(err) {
                alert("Error occurred: " + err);
            }
            $(self.target).removeClass("hover"); 
            event.stopPropagation();
            event.preventDefault();
        }, false);

        this._cnt.addEventListener("dragenter", function(event) {
            $(self.target).addClass("hover"); 
        }, false);

        this._cnt.addEventListener("dragexit", function(event) { 
            $(self.target).removeClass("hover"); 
        }, false);

        this._cnt.addEventListener("dragover", function(event) { 
            event.preventDefault(); 
        }, false);

        this._cnt.addEventListener("dragleave", function(event) { 
            $(self.target).removeClass("hover"); 
            event.preventDefault(); 
        }, false);

        
        $(this._cnt).bind("mouseenter mouseleave", function(event) {
            if (event.type == "mouseenter") {
                $(self.target).addClass("hover"); //.text("Click to upload images...");


            } else if (event.type == "mouseleave") {
                //self._fakeinput.detach();
                $(self.target).removeClass("hover"); //.text("Drop images here...");
            }
        });

        this._fakeinput.change(function(event) {
            if (!this.files || this.files.length == 0)
                return;
            self.uploadPost(this.files);
        });
    },

    registerTextParameter: function(element) {
        if (!$(element).attr("name"))
            throw "Text parameter: '" + $(element).attr("id") 
                        + "' has no 'name' attribute (required)";
        this._params.push(element);
        $.unique(this._params);
    },

    parameters: function() {
        var params = {};
        $.each(this._params, function(i, elem) {
            params[$(elem).attr("name")] = $(elem).val();
        });
        return params;    
    },

    uploadPost: function(files) {
        this.onUploadsStarted();

        // chuck away all but the first file if not
        // in multi mode
        if (!this.options.multi)
            files = [files[0]]

        for (var i = 0; i < files.length; i++) {
            if (files[i].type.search("image/") == -1) {
                throw("invalid file type: " + files[i].type);
            }
        }
        this._maxsize = files.length;

        for (var i = 0; i < files.length; i++) {
            this._queue.push(files[i]);
        }
        this.postNextItem();
    },                    
                
    postNextItem: function() {
        if (!this._queue.length) {
            this.onUploadsFinished();
            return false;
        }

        var self = this;                      
        var file = this._queue.shift();
        var xhr = new XMLHttpRequest();
        xhr.onload = function(event) {
            self.postNextItem();
            self.onXHRLoad(event);        
        };

        var params = this.parameters();
        params["inlinefile"] = file.fileName;
        var urlstring = this.getQueryString(params);
        this.onUploadStart()
        xhr.open("POST", urlstring, true);
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader('content-type', file.type); 
        xhr.send(file);
    },

    getQueryString: function(params) {
        var p = [];
        $.each(params, function(k, v) {
            p.push(k + "=" + v);            
        });
        return (this.url + "?" + p.join("&")).replace(/\?$/, "");
    },

    size: function() {
        return this._maxsize;
    },

    // callbacks:
    onXHRLoad: function(event) {

    },

    onUploadStart: function(event) {

    },

    onUploadEnd: function(event) {

    },

    onUploadsStarted: function(event) {

    },

    onUploadsFinished: function(event) {

    },
});

