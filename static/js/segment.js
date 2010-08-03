
$(function() {
    
    // initialise the controls
    pbuilder = new ParameterBuilder("options", 
            ["ISegmentPage"]);
    pbuilder.registerComponent("psegmenter", "Page Segmenter", "SegmentPageByRAST");
    pbuilder.init();


});



