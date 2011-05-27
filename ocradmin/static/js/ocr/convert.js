//
// Handle drag and drop page conversions
//

var PAGES = [];     // list of current pages in view
var PENDING = {};   // hash of jobnames -> pending pages
var POLLTIMER = -1; // id of current results-polling timer

// should probably be moved to app-global scope
const MINFONTSIZE = 6;
const MAXFONTSIZE = 40;

// only in global scope for dubugging purposes
var uploader = null;
var formatter = null;
var pbuilder = null;
var sdviewer = null;

function saveState() {
    pbuilder.saveState();

    // save the job names of the current pages...
    var jobnames = $.map(PAGES, function(page, i) {
        return page.pageName() + ":" + page.id();
    }).join(",");
    $.cookie("jobnames", jobnames, {expires: 7});
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

    var timer = null;

    function pollForResults(node, taskid) {
        console.log("Polling", node, taskid);
        timer = setTimeout(function() {
            $.ajax({
                url: "/plugins/results/" + taskid,
                success: function(ndata) {
                    ndata = ndata[0];
                    console.log("Data: status", ndata["status"], "Data", ndata);
                    if (ndata.status == "PENDING")
                        return pollForResults(node, taskid);
                    else {
                        // assume success!
                        sdviewer.setBufferPath(0, ndata.result.dzi); 
                    }
                }
            });
        }, 200);        
    }

    // line formatter object
    sdviewer = new OCRJS.ImageViewer($(".viewer").get(0), {
        numBuffers: 1,        
    });
    formatter = new OCRJS.LineFormatter();
    pbuilder = new OCRJS.ParameterBuilder(document.getElementById("options"));
    pbuilder.addListener("resultPending", function(node, pendingdata) {
        pollForResults(node, pendingdata.task_id);
    });
    pbuilder.init();
});

