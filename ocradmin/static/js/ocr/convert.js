//
// Handle drag and drop page conversions
//

// should probably be moved to app-global scope
const MINFONTSIZE = 6;
const MAXFONTSIZE = 40;

// only in global scope for dubugging purposes
var uploader = null;
var formatter = null;
var pbuilder = null;
var sdviewer = null;
var reshandler = null;

function saveState() {
    pbuilder.saveState();
}


function loadState() {

}




$(function() {

    // style toolbar
    $(".tbbutton").button({
        disabled: true,
    });
    $("#clear").button({
        icons: {
            primary: "ui-icon-closethick",
        }
    });
    $("#format").buttonset();
    $("#clear").click(function(event) {
        alert("I don't do anything!");
    });
    $("#zoomin").click(function(event) {
        $("#font_size").val(parseInt($("#font_size").val()) + 2);
        $("#zoomin").button({"disabled": $("#font_size").val() >= MAXFONTSIZE});
        $("#zoomout").button({"disabled": $("#font_size").val() <= MINFONTSIZE});
        $(".ocr_page").css("font-size", $("#font_size").val() + "px");
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });
    $("#zoomout").click(function(event) {
        $("#font_size").val(parseInt($("#font_size").val()) - 2);
        $("#zoomin").button({"disabled": $("#font_size").val() >= MAXFONTSIZE});
        $("#zoomout").button({"disabled": $("#font_size").val() <= MINFONTSIZE});
        $(".ocr_page").css("font-size", $("#font_size").val() + "px");
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });
    $("#format_block").click(function(event) {
        formatter.blockLayout($(".ocr_page"));
    });
    $("#format_line").click(function(event) {
        formatter.lineLayout($(".ocr_page"));
    });
    $("#format_column").click(function(event) {
        $(".ocr_page").each(function(pos, elem) {
            formatter.columnLayout($(elem));
        });
    });

    // initialise the uploader...
    var uploader  = new OCRJS.AjaxUploader(
        $("#dropzone").get(0),
        "/plugins/upload/", 
        { multi: false, errorhandler: OCRJS.ajaxErrorHandler, }
    );
    // FIXME: No error handling
    uploader.addListener("onXHRLoad", function(data) {
        pbuilder.setFileInPath(JSON.parse(data.target.response).file);
    });

    // load state stored from last time
    loadState();
    
    // save state on leaving the page... at least try to...
    window.onbeforeunload = function(event) {
        try {
            saveState();
        } catch (msg) {
            alert(msg);
        }
    }

    sdviewer = new OCRJS.ImageViewer($(".viewer").get(0), {
        numBuffers: 2,        
    });
    reshandler = new OCRJS.ResultHandler();
    formatter = new OCRJS.LineFormatter();
    pbuilder = new OCRJS.ParameterBuilder(document.getElementById("options"));
    pbuilder.addListener("resultPending", function(node, pendingdata) {
        reshandler.watchNode(node, pendingdata);
    });
    reshandler.addListener("resultDone", function(node, data) {
        // this magic hides the buffer loading transition by putting the
        // new data in the back buffer and switching them after a delay
        // TODO: Find if we can subscript to an event to tell us exactly
        // when it's safe to switch.  ATM just using a 200ms delay.
        var active = sdviewer.activeBuffer();
        sdviewer.setBufferPath(active^1, data.result.dzi);
        setTimeout(function() {
            sdviewer.setActiveBuffer(active^1);
        }, 200);
    }); 
    pbuilder.init();
});

