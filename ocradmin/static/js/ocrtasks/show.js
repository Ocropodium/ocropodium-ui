$(function() {

    $("#tabs").tabs();

    var pk = $("#task_pk_cache").val();
    $.getJSON("/ocr/task_config/" + pk + "/", function(data) {
        var pbuilder = new OCRJS.ParameterBuilder(
            $("#options").get(0), data);
        pbuilder.init();
    });

});
