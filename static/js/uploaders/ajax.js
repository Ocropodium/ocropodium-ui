// Upload files via Ajax File API.  This is currently only supported by Firefox,
// but it allows multiple files to be uploaded at once.


OCRJS.AjaxUploader = OCRJS.OcrBase.extend({
    constructor: function(target, url, options) {
        this.target = target;
        this.url = url;
        this.base();
        
        $.extend(this.options, options);
        this._maxsize = 0;
        this._queue = [];
        this._params = [];
        this._xhrqueue = [];

        this.setupEvents();
    },


    setupEvents: function() {
        var self = this;

        this.target.addEventListener("drop", function(event) {
            try {
                self.upload(event);            
            } catch(err) {
                alert(err);
            }
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
    upload: function(event) {
        // upload-related bits
        var
        boundary = "------multipartformboundary" + (new Date).getTime(),
        dashdash = "--",
        crlf     = "\r\n";


        this.onUploadsStarted();        

        var data = event.dataTransfer;
        for (var i = 0; i < data.files.length; i++) {
            if (data.files[i].type.search("image/") == -1) {
                alert("Error: invalid file type: " + data);
                event.stopPropagation();
                return;
            }
        }
        this._maxsize = data.files.length;

        // Show spinner for each dropped file and say we're busy. 
        // Nope - do this in the callback from the subscriber
        //$(dropzone).text("Please wait...").addClass("waiting");
        

        for (var i = 0; i < data.files.length; i++) {

            var file = data.files[i];
            var binaryReader = new FileReader();    

            // Build RFC2388 string. 
            var builder = "";
            builder += dashdash;
            builder += boundary;
            builder += crlf;

            // append text param values 
            $.each(this.parameters(), function(key, value) {
                builder += "Content-Disposition: form-data; name='" + key + "'; ";
                builder += "Content-Type: text/plain";
                builder += crlf;
                builder += crlf;
                builder += value;
                builder += crlf;
                builder += dashdash;
                builder += boundary;
                builder += crlf;
            });
            
            // Generate headers.
            builder += "Content-Disposition: form-data; ";
            builder += "name='userfile" + i + "[]'";
            if (file.fileName) {
              builder += "; filename='" + file.fileName + "'";
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
                xhr.onload = onXHRLoad;
                this._queue.push(xhr);
            } catch (e) {
                alert(e);
            }
        }
        // start uploading
        this.sendNextItem();
        alert("Uploading...");

        // Prevent FireFox opening the dragged file. 
        event.stopPropagation();
        
    },

    sendNextItem: function() {
        if (this._queue.length) {
            var
            boundary = "------multipartformboundary" + (new Date).getTime(),
            fxhr = this._queue.shift();

            this.onUploadStart()
           
            fxhr.open("POST", this.url, true);
            fxhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            fxhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + boundary); 
            fxhr.sendAsBinary(fxhr.builder);
        } else {
            this.onUploadsFinished();
        }  
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


