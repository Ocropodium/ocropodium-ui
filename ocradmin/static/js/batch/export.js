$(function() {
    $("#tabs").tabs();

    $("#submit_export_form").attr("disabled", true)

    $(".export_format").change(function(event) {
        $("#submit_export_form")
            .attr("disabled", $(".export_format:checked").length == 0);
    });

});
