
$(function() {
    // initialise the controls
    pbuilder = new OCRJS.ParameterBuilder(document.getElementById("options"));
    pbuilder.init();


    sdviewer.addListener("onCanvasChanged", function() {
        var shapes = sdviewer.getRects(); 
        var str = $.map(shapes, function(arr, index) {
            return $.map(arr, function(v, i) {
                return Math.round(v);
            }).join(",");
        }).join("~");
        $("input[name$='.coords']").val(str);
    });
});



