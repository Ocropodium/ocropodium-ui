var transcript = null;

$(function() {

    $("#page_slider").slider({min: 1});

    transcript = new OcrTranscript("document_window", $("#batch_id").val());   
    transcript.onBatchLoad = function() {
        $("#page_slider").slider({max: transcript.pageCount()});
    }

    transcript.onPageLoad = function() {

    }

    $("#page_slider").slider({
        stop: function(e, ui) {
            transcript.setPage($("#page_slider").slider("option", "value") - 1);
        },
        
    })

    transcript.init();
});        

