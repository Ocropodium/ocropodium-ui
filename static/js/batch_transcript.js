var transcript = null;

$(function() {
    transcript = new OcrTranscript("document_window", $("#batch_id").val());    
    transcript.init();
});        

