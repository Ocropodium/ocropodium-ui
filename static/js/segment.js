
$(function() {
    
    // initialise the controls
    var pbuilder = new ParameterBuilder("options", 
            ["ISegmentPage"]);
    pbuilder.registerComponent("psegmenter", "Segmenter", "SegmentPageByRAST");
    pbuilder.init();


});



