// Ajax uploader class.  This uses the (deprecated) getAsBinary() method and
// only works for Mozilla.  Also it relies on Jquery...
//
// FIXME:  General weirdness... don't understand how JS works
// Need to take the functions out of the constructor closure
// code adapted from http://www.appelsiini.net/demo/html5_upload/demo.html 



function AjaxUploader(url, dropzone_id) {
    var dropzone = $("#" + dropzone_id).get(0);    
    var queue = [];
    var m_params = [];
    var maxsize = 0;

    // Request building guff
    var xhrqueue = [];
    var boundary = '------multipartformboundary' + (new Date).getTime();
    var dashdash = '--';
    var crlf     = '\r\n';


    // note - re-reference 'self' to 'this' so it refers to the
    // correctly-scoped this via the closure...
    var self = this;

    // dequeue and send the next file...
    var sendNextItem = function() {
        if (queue.length) {
            self.onUploadStart()
            var fxhr = queue.shift();
            fxhr.open("POST", url, true);
            fxhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            fxhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + boundary); 
            fxhr.sendAsBinary(fxhr.builder);
        } else {
            $(dropzone).text("Drop images here...").removeClass("waiting"); 
            self.onUploadsFinished();
        }  
    }

    // wrap the user event function so as to trigger the
    // next upload in the queue
    var onXHRLoad = function(event) {
        self.onXHRLoad(event);
        sendNextItem();
    }


    // accessor for the size of the queue
    this.size = function() {
        return maxsize;
    }

    // return a hash of text param key/vals
    var textParameters = function() {
        params = {};
        $.each(m_params, function(index, paramname) {
            if ($(paramname).length) {
                params[$(paramname).attr("name")] = $(paramname).val();
            }
        });
        return params;
    }

    this.textParameters = function() {
        return textParameters();
    }

    // register a new text parameter to be included when the upload
    // commences
    this.registerTextParameter = function(paramname) {
        m_params.push(paramname);
    }


    // actually do the upload!
    var upload = function(event) {
        self.onUploadsStarted();        

        var data = event.dataTransfer;
        for (var i = 0; i < data.files.length; i++) {
            if (data.files[i].type.search("image/") == -1) {
                alert("Error: invalid file type: " + data.files[i].type);
                event.stopPropagation();
                return;
            }
        }
        maxsize = data.files.length;

        /* Show spinner for each dropped file and say we're busy. */
        $(dropzone).text("Please wait...").addClass("waiting");
        for (var i = 0; i < data.files.length; i++) {


            var file = data.files[i];
            var binaryReader = new FileReader();    
            /* Build RFC2388 string. */
            var builder = '';
            builder += dashdash;
            builder += boundary;
            builder += crlf;

            /* append text param values */
            $.each(textParameters(), function(key, value) {
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
            
            /* Generate headers. */            
            builder += 'Content-Disposition: form-data; ';
            builder += 'name="userfile' + i + '[]"';
            if (file.fileName) {
              builder += '; filename="' + file.fileName + '"';
            }
            builder += crlf;

            builder += 'Content-Type: ' + file.type;
            builder += crlf;
            builder += crlf; 

            /* Append binary data. */
            builder += file.getAsBinary() ;//binaryReader.readAsBinaryString(file);
            builder += crlf;

            /* Write boundary. */
            builder += dashdash;
            builder += boundary;
            builder += crlf;
            /* Mark end of the request. */
            builder += dashdash;
            builder += boundary;
            builder += dashdash;
            builder += crlf;
            try {
                var xhr = new XMLHttpRequest();
                xhr.builder = builder;
                xhr.onload = onXHRLoad;
                queue.push(xhr);
            } catch (e) {
                alert(e);
            }
        }
        // start uploading
        sendNextItem();

        /* Prevent FireFox opening the dragged file. */
        event.stopPropagation();
        
    }



    // Register the drag-drop functions to be called when the
    // target element is triggered
    dropzone.addEventListener('drop', upload, false);
    dropzone.addEventListener('dragenter', function(event) {
            $(this).addClass("hover"); 
        }, false);
    dropzone.addEventListener('dragexit', function(event) { 
            $(this).removeClass("hover"); 
        }, false);
    dropzone.addEventListener('dragover', function(event) { 
            event.preventDefault(); 
        }, false);
}


// Events
AjaxUploader.prototype.onXHRLoad = function(event) {
}

AjaxUploader.prototype.onUploadStart = function(event) {
}

AjaxUploader.prototype.onUploadEnd = function(event) {
}

AjaxUploader.prototype.onUploadsStarted = function(event) {
}

AjaxUploader.prototype.onUploadsFinished = function(event) {
}




