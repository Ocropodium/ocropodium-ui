
$(function() {

    $("#id_name, #id_cmodel").change(function(event) {
        var ok = $.trim($("#id_name").val()) 
            && parseInt($("#id_cmodel").val());
        $("#submit_new_training_form").attr("disabled", !ok);
    });

    $("#tabs").tabs();
    // make steps into tabs
    $(".next_tab").click(function(event) {
        var tabid = $(this).attr("id").replace(/_next/, "_link");
        $("#" + tabid).trigger("click");
    });
});
