// Ajax uploader class.  This uses the (deprecated) getAsBinary() method and
// only works for Mozilla.  Also it relies on Jquery...
//
// FIXME:  General weirdness... don't understand how JS works
// Need to take the functions out of the constructor closure
// code adapted from http://www.appelsiini.net/demo/html5_upload/demo.html 



function AjaxBatchUploader(url, dropzone_id) {
    var dropzone = $("#" + dropzone_id).get(0);    
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

    onXHRLoad = function(event) {
        $(dropzone).text("Drop images here...").removeClass("waiting"); 
        self.onXHRLoad(event);
    }


    // accessor for the size of the queue
    this.size = function() {
        return maxsize;
    }

    // return a hash of text param key/vals
    textParameters = function() {
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
    upload = function(event) {

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

        var builder = '';
        /* Build RFC2388 string. */
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
        
        /* Show spinner for each dropped file and say we're busy. */
        $(dropzone).text("Please wait...").addClass("waiting");
        for (var i = 0; i < data.files.length; i++) {
            var file = data.files[i];
            var binaryReader = new FileReader();    
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
        }
        // start uploading
        var xhr = new XMLHttpRequest();
        xhr.onload = onXHRLoad;
        xhr.open("POST", url, true);
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + boundary); 
        xhr.sendAsBinary(builder);

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
AjaxBatchUploader.prototype.onXHRLoad = function(event) {
}

AjaxBatchUploader.prototype.onUploadStart = function(event) {
}

AjaxBatchUploader.prototype.onUploadEnd = function(event) {
}

AjaxBatchUploader.prototype.onUploadsStarted = function(event) {
}

AjaxBatchUploader.prototype.onUploadsFinished = function(event) {
}




