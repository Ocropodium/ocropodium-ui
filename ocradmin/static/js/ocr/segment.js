
$(function() {
    // initialise the controls
    pbuilder = new OCRJS.ParameterBuilder(document.getElementById("options"));
    pbuilder.init();


    sdviewer.addListener("onCanvasChanged", function() {
        sdviewer.getRects(); 
    });
});



