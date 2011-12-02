//
// Upload multiple files in a relay.  In addition to the
// uploaded file (which is the whole POST body) extra GET
// parameters can also be set.
//


OcrJs.AjaxUploader = OcrJs.Base.extend({
    init: function(target, url, options) {
        this.target = target;
        this.url = url;
        this._super();
        this.options = {
            log: true,      // whether to, uh, log
            multi: true,    // whether to accept multiple files
            errorhandler: OcrJs.ajaxErrorHandler,
            fakeinput: true,
            mimetypes: ["image/png"],
        };
        $.extend(this.options, options);

        this._listeners = {
            uploadStart: [],
            uploadResult: [],
            uploading: [],
            complete: [],
            mouseOver: [],
            mouseOut: [],
            hoverOver: [],
            hoverOut: [],
            drop: [],            
        };

        this._maxsize = 0;
        this._queue = [];
        this._params = [];

        if (this.target)
            this.setTarget()

    },

    setTarget: function(elem) {
        this.target = elem || this.target;
        $(this.target).wrap($("<span></span>"));
        if (this.options.fakeinput) {
            this._fakeinput = $("<input></input>")
                .attr("type", "file")
                .attr("id", "fakeinput")
                .attr("multiple", this.options.multi ? "multiple" : null)
                .width($(this.target).outerWidth())
                .height($(this.target).outerHeight())
                .css({
                    position: "fixed",
                    opacity: 0,
                    top: $(this.target).offset().top + "px",
                    left: $(this.target).offset().left + "px",
                }).insertAfter(this.target);
            this._cnt = $(this.target).parent().get(0);
        } else {
            this._cnt = $(this.target).get(0);
        }
        
        this.setupEvents();

    },

    setupEvents: function() {
        var self = this;

        this._cnt.addEventListener("drop", function(event) {
            self.trigger("drop");
            try {
                self.uploadPost(event.dataTransfer.files);
            } catch(err) {
                alert("Error occurred: " + err);
            }
            event.stopPropagation();
            event.preventDefault();
        }, false);

        this._cnt.addEventListener("dragenter", function(event) {
            self.trigger("hoverOver");
        }, false);

        this._cnt.addEventListener("dragexit", function(event) {
            self.trigger("hoverOut");
        }, false);

        this._cnt.addEventListener("dragover", function(event) {
            self.trigger("hoverOver");
            event.preventDefault();
        }, false);

        this._cnt.addEventListener("dragleave", function(event) {
            self.trigger("hoverOut");
            event.preventDefault();
        }, false);

        
        $(this._cnt).bind("mouseenter mouseleave", function(event) {
            self.trigger(event.type == "mouseenter" ? "mouseOver" : "mouseOut");
        });

        if (this.options.fakeinput) {
            this._fakeinput.change(function(event) {
                if (!this.files || this.files.length == 0)
                    return;
                self.uploadPost(this.files);
            });
        }
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

    clearParameters: function() {
        this._params = [];
    },

    uploadPost: function(files) {
        this.trigger("uploading", files);

        // chuck away all but the first file if not
        // in multi mode
        if (!this.options.multi)
            files = [files[0]]

        for (var i = 0; i < files.length; i++) {
            if (! ~$.inArray(files[i].type, this.options.mimetypes)) {
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
            this.trigger("complete");
            return false;
        }

        var self = this;
        var file = this._queue.shift();
        var xhr = new XMLHttpRequest();
        xhr.onload = function(event) {
            self.postNextItem();
            self.trigger("uploadResult", event, file.fileName, file.type);
        };
        xhr.onerror = OcrJs.ajaxErrorHandler;

        var params = this.parameters();
        params["inlinefile"] = file.fileName;
        var urlstring = this.getQueryString(params);
        this.trigger("uploadStart", file.fileName);
        xhr.open("POST", urlstring, true);
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader("X-File-Name", file.fileName);
        xhr.setRequestHeader("X-File-Size", file.fileSize);
        xhr.setRequestHeader("X-File-Type", file.type);
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

});


