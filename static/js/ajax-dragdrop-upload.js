// Ajax uploader class.  This uses the (deprecated) getAsBinary() method and
// only works for Mozilla.  Also it relies on Jquery...
//
// FIXME:  General weirdness... don't understand how JS works
// Need to take the functions out of the constructor closure
// code adapted from http://www.appelsiini.net/demo/html5_upload/demo.html 

// Globals, want to get rid of these eventually
var XHRQUEUE = [];
var BOUNDARY = '------multipartformboundary' + (new Date).getTime();
var DASHDASH = '--';
var CRLF     = '\r\n';


function AjaxUploader(url, dropzone_id) {
    dropzone = $("#" + dropzone_id).get(0);    
    _queue = [];
    _params = [];

    // note - re-reference 'me' to 'this' so it refers to the
    // correctly-scoped this via the closure...
    var me = this;

    // dequeue and send the next file...
    _sendNextItem = function() {
        if (_queue.length) {
            me.onUploadStart()
            var fxhr = _queue.shift();
            fxhr.open("POST", url, true);
            fxhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            fxhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + BOUNDARY); 
            fxhr.sendAsBinary(fxhr.builder);
        } else {
            $(dropzone).text("Drop images here...").removeClass("waiting"); 
            me.onUploadsFinished();
        }  
    }

    // wrap the user event function so as to trigger the
    // next upload in the queue
    _onXHRLoad = function(event) {
        me.onXHRLoad(event);
        _sendNextItem();
    }


    // accessor for the size of the queue
    this.size = function() {
        return _queue.length;
    }

    // return a hash of text param key/vals
    _textParameters = function() {
        params = {};
        $.each(_params, function(index, paramname) {
            if ($(paramname).length) {
                params[$(paramname).attr("name")] = $(paramname).val();
            }
        });
        return params;
    }

    this.textParameters = function() {
        return _textParameters();
    }

    // register a new text parameter to be included when the upload
    // commences
    this.registerTextParameter = function(paramname) {
        _params.push(paramname);
    }


    // actually do the upload!
    upload = function(event) {

        me.onUploadsStarted();        

        var data = event.dataTransfer;
        for (var i = 0; i < data.files.length; i++) {
            if (data.files[i].type.search("image/") == -1) {
                alert("Error: invalid file type: " + data.files[i].type);
                event.stopPropagation();
                return;
            }
        }
        /* Show spinner for each dropped file and say we're busy. */
        $(dropzone).text("Please wait...").addClass("waiting");
        for (var i = 0; i < data.files.length; i++) {


            var file = data.files[i];
            var binaryReader = new FileReader();    
            /* Build RFC2388 string. */
            var builder = '';
            builder += DASHDASH;
            builder += BOUNDARY;
            builder += CRLF;

            /* append text param values */
            $.each(_textParameters(), function(key, value) {
                builder += 'Content-Disposition: form-data; name="' + key + '"; ';
                builder += 'Content-Type: text/plain';
                builder += CRLF;
                builder += CRLF;
                builder += value;
                builder += CRLF;
                builder += DASHDASH;
                builder += BOUNDARY;
                builder += CRLF;
            });
            
            /* Generate headers. */            
            builder += 'Content-Disposition: form-data; ';
            builder += 'name="userfile' + i + '[]"';
            if (file.fileName) {
              builder += '; filename="' + file.fileName + '"';
            }
            builder += CRLF;

            builder += 'Content-Type: ' + file.type;
            builder += CRLF;
            builder += CRLF; 

            /* Append binary data. */
            builder += file.getAsBinary() ;//binaryReader.readAsBinaryString(file);
            builder += CRLF;

            /* Write BOUNDARY. */
            builder += DASHDASH;
            builder += BOUNDARY;
            builder += CRLF;
            /* Mark end of the request. */
            builder += DASHDASH;
            builder += BOUNDARY;
            builder += DASHDASH;
            builder += CRLF;
            try {
                var xhr = new XMLHttpRequest();
                xhr.builder = builder;
                xhr.onload = _onXHRLoad;
                _queue.push(xhr);
            } catch (e) {
                alert(e);
            }
        }
        // start uploading
        _sendNextItem();

        /* Prevent FireFox opening the dragged file. */
        event.stopPropagation();
        
    }



    // Register the drag-drop functions to be called when the
    // target element is triggered
    dropzone.addEventListener('drop', upload, false);
    dropzone.addEventListener('dragenter', function(event) { 
            $(this).css("background-color", "#ffc"); 
        }, false);
    dropzone.addEventListener('dragexit', function(event) { 
            $(this).css("background-color", "#fff"); 
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




