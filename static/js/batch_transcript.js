var transcript = null;
var sdviewer = null;
var polltimeout = -1;


function onBinaryFetchResult(data) {


}

function pollForResults(data, polltime) {
    if (data == null) {
        alert("Return data is null!");
    } else if (data.error) {
        alert(data.error);
    } else if (data.status == "PENDING") {
        $.ajax({
            url: "/batch/viewer_binarization_results/" + data.job_name + "/",
            dataType: "json",
            beforeSend: function(e) {
                sdviewer.setWaiting(true);
            },
            success: function(data) {
                if (polltimeout != -1) {
                    clearTimeout(polltimeout);
                    polltimeout = -1;
                }
                polltimeout = setTimeout(function() {
                    pollForResults(data, polltime);
                }, polltime);        
            },
            error: function(e) {
                alert(e);
            },
        });
    } else if (data.status == "SUCCESS") {
        sdviewer.setSource(data.results.src);
        sdviewer.setOutput(data.results.dst);
        sdviewer.setWaiting(false);
    }
}


$(function() {

    // FIXME FIXME FIXME FIXME
    // Setting the width of the sidebar to be bigger, since it's holding
    // a viewer.

    //$("#sidebar").css("width", "600px");

    $("#page_slider").slider({min: 1, value: 1});

    transcript = new OcrTranscript("workspace", $("#batch_id").val());   
    transcript.init();
    transcript.onBatchLoad = function() {
        $("#page_slider").slider({max: transcript.pageCount()});
    }

    transcript.onPageChange = function() {
        var ismax = $("#page_slider").slider("option", "value") 
                == transcript.pageCount();
        var ismin = $("#page_slider").slider("option", "value") == 1; 
        $("#next_page").attr("disabled", ismax);         
        $("#prev_page").attr("disabled", ismin);
    }

    // When a page loads, read the data and request the source
    // image is rebinarized so we can view it in the viewer
    // This is likely to be horribly inefficient, at least
    // at first...
    transcript.onPageLoad = function() {
        // get should-be-hidden implementation details
        // i.e. the task id that process the page.  We
        // want to rebinarize with the same params
        var task_pk = transcript.pageData().pk;
        $.ajax({
            url: "/batch/submit_viewer_binarization/" + task_pk + "/",
            dataType: "json",
            beforeSend: function(e) {
                sdviewer.close();
                sdviewer.setWaiting(true);
            },
            success: function(data) {
                if (polltimeout != -1) {
                    clearTimeout(polltimeout);
                    polltimeout = -1;
                }
                pollForResults(data, 300);
            },
            error: function(e) {
                alert(e);
            },
        });
    }

    transcript.onClickPosition = function(position) {
        if (!($("#link_viewer").attr("checked") && sdviewer.activeViewer().viewport))
            return;

        // ensure the given line is centred in the viewport
        var bounds = transcript.pageData().fields.results.box;
        var fw = bounds[2], fh = bounds[3];
        var x = position[0], y = position[1], w = position[2], h = position[3];        
        var rect = new Seadragon.Rect(x / fw, (y - h) / fw, w / fw, h / fw);
        var overlaydiv = document.createElement("div");
        $(overlaydiv).addClass("viewer_highlight");
        sdviewer.activeViewer().viewport.fitBounds(rect, true);
        sdviewer.activeViewer().drawer.clearOverlays(); 
        sdviewer.activeViewer().drawer.addOverlay(overlaydiv, rect);         
    }

    $("#spellcheck").click(function(event) {
        var text = [];
        $(".ocr_line").each(function(i, elem) {
            text.push($(elem).text());
        });

        $.ajax({
            url: "/batch/spellcheck",
            type: "POST",
            data: {text: text.join("\n")},
            dataType: "json",
            success: function(data) {
                alert(data);
            },
        });
    });

    $("#page_slider").slider({
        change: function(e, ui) {
            transcript.setPage($("#page_slider").slider("option", "value") - 1);
        },
        
    });

    $("#prev_page").click(function(event) {
        var curr = $("#page_slider").slider("option", "value");
        $("#page_slider").slider("option", "value", curr - 1);
    });

    $("#next_page").click(function(event) {
        var curr = $("#page_slider").slider("option", "value");
        $("#page_slider").slider("option", "value", curr + 1);
    });
    
    
    
    sdviewer = new ImageWindow("sideviewer"); 
    sdviewer.init();

    layoutWidgets();
});        

