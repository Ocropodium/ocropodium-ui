
$(function() {
    
    // initialise the controls
    pbuilder = new ParameterBuilder(
        document.getElementById("options"), 
        ["ISegmentPage"]
    );
    pbuilder.registerComponent("psegmenter", "Page Segmenter", "SegmentPageByRAST");
    pbuilder.init();
});



