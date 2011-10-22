//
// Misc global helper functions
//


var OcrJs = OcrJs || {};

//
// Django's 500 template is hard to read in ajax calls,
// so make it pop up in an iframe dialog instead.  This
// assumes that no errors are thrown within this function!
//
OcrJs.ajaxErrorHandler = function(xhr, status, errorThrown) {
    var errdiv = $("<div></div>")
        .appendTo($("body"));
    var iframe = $("<iframe></iframe>")
        .attr("name", "debugout")
        .addClass("debugwindow")
        .appendTo(errdiv).get(0);
    errdiv.dialog({
        width: 700,
        height: 700,
        title: status,
        close: function(e) {
            errdiv.remove();
        },
    });                        
    var iframedoc = iframe.contentWindow.document;
    iframedoc.open();
    iframedoc.write(xhr.responseText);
    iframedoc.close();
}

