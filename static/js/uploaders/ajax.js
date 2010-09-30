// Upload files via Ajax File API.  This is currently only supported by Firefox,
// but it allows multiple files to be uploaded at once.


OCRJS.AjaxUploader = OCRJS.OcrBase.extend({
    constructor: function(target, url, options) {
        this.target = target;
        this.url = url;
        this.base();
        
        $.extend(this.options, options);
        this._boundary = '------multipartformboundary' + (new Date).getTime(),
        this._maxsize = 0;
        this._queue = [];
        this._params = [];
        this._xhrqueue = [];

        this.setupEvents();
    },


    setupEvents: function() {
        var self = this;

        this.target.addEventListener("drop", function(event) {
            var data = event.dataTransfer;
            try {
                self.upload(data);            
            } catch(err) {
                alert("Error occurred: " + err);
            }
            event.stopPropagation();
        }, false);

        this.target.addEventListener("dragenter", function(event) {
            $(this).addClass("hover"); 
        }, false);

        this.target.addEventListener("dragexit", function(event) { 
            $(this).removeClass("hover"); 
        }, false);

        this.target.addEventListener("dragover", function(event) { 
            event.preventDefault(); 
        }, false);
            

    
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


    // actually do the upload!
    upload: function(data) {
        // upload-related bits
        var
        boundary = this._boundary,
        dashdash = '--',
        crlf     = '\r\n';


        this.onUploadsStarted();        

        for (var i = 0; i < data.files.length; i++) {
            if (data.files[i].type.search("image/") == -1) {
                throw("invalid file type: " + data);
            }
        }
        this._maxsize = data.files.length;

        // Show spinner for each dropped file and say we're busy. 
        // Nope - do this in the callback from the subscriber
        //$(dropzone).text("Please wait...").addClass("waiting");
        

        for (var i = 0; i < data.files.length; i++) {
            var file = data.files[i];

            // Build RFC2388 string. 
            var builder = "";
            builder += dashdash;
            builder += boundary;
            builder += crlf;

            // append text param values 
            $.each(this.parameters(), function(key, value) {
                builder += 'Content-Disposition: form-data; name="' + key + '"; ';
                builder += 'Content-Type: text/plain';
                builder += crlf;
                builder += crlf;
                builder += value;
                builder += crlf;
                builder += dashdash;
                builder += boundary;
                builder += crlf;
            });
            
            // Generate headers.
            builder += 'Content-Disposition: form-data; ';
            builder += 'name="userfile' + i + '[]"';
            if (file.fileName) {
                builder += '; filename="' + file.fileName + '"';
            }
            builder += crlf;

            builder += "Content-Type: " + file.type;
            builder += crlf;
            builder += crlf; 

            // Append binary data. 
            builder += file.getAsBinary() ;
            builder += crlf;

            // Write boundary. 
            builder += dashdash;
            builder += boundary;
            builder += crlf;
            // Mark end of the request. 
            builder += dashdash;
            builder += boundary;
            builder += dashdash;
            builder += crlf;
            try {
                var xhr = new XMLHttpRequest();
                xhr.builder = builder;
                xhr.onload = this.onXHRLoad;
                this._queue.push(xhr);
            } catch (e) {
                alert(e);
            }
        }
        // start uploading
        this.sendNextItem();
    },

    sendNextItem: function() {
        if (this._queue.length) {
            var fxhr = this._queue.shift();
            this.onUploadStart()
           
            fxhr.open("POST", this.url, true);
            fxhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            fxhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + this._boundary); 
            fxhr.sendAsBinary(fxhr.builder);
        } else {
            this.onUploadsFinished();
        }  
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


