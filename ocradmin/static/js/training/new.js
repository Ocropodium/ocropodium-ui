
$(function() {

    $("#id_name, #id_cmodel, .ground_truth_enabled").change(function(event) {
        var ok = $.trim($("#id_name").val()) 
            && parseInt($("#id_cmodel").val());
        // check at least one groundtruth is selected
        var gotgt = $("input.ground_truth_enabled[@type=checkbox][checked]").length;
        $("#submit_new_training_form").attr("disabled", !(gotgt && ok));
    });

    $("#tabs").tabs();
});
