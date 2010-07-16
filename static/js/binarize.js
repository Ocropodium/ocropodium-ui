
var getCropRect = null;


$(function() {

    // initialise the controls
    var pbuilder = new ParameterBuilder("options", 
            ["IBinarize", "ICleanupGray", "ICleanupBinary"]);
    pbuilder.registerDefaultMetaComponent("StandardPreprocessing");
    pbuilder.init();
});


