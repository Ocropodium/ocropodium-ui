
$(function() {
    
    // initialise the controls
    pbuilder = new ParameterBuilder("options", 
            ["ISegmentPage"]);
    pbuilder.registerComponent("psegmenter", "Segmenter", "SegmentPageByRAST");
    pbuilder.init();


});



