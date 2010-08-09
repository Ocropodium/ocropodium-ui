// Class for showing a GUI for correcting transcripts of OCR batches
//


function OcrTranscript(insertinto_id, batch_id) {
    var m_batch_id = batch_id;

    // alias 'this' for use from within callbacks
    var self = this;

    // UI bits it's useful to keep a reference to:
    var m_container = $("<div></div>")
        .addClass("widget");  
    var m_header = $("<div></div>")
        .addClass("batch_head")
        .addClass("widget_header")
        .attr("id", "batch_head")
        .text("OCR Batch");
    var m_batchdiv = $("<div></div>")
        .addClass("ocr_transcript")
        .addClass("waiting")
        .attr("id", "ocr_transcript");



    this.init = function() {
        self.buildUi();
        self.refresh();
    }

    this.refresh = function() {
        setData();
    }

    this.setBatchId = function(batch_id) {
        m_batch_id = batch_id;
        self.refresh();
    }

    this.refresh = function() {

    }

    this.buildUi = function() {
        m_container.append(m_header).append(m_batchdiv).appendTo("#" + insertinto_id);
    }
}

