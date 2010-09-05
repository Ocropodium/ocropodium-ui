
function validateForm() {
    var a = parseInt($("#cmodel_a").val()), 
        b = parseInt($("#cmodel_b").val());
    // check at least one groundtruth is selected
    var gotgt = $("input.ground_truth_enabled[@type=checkbox][checked]").length;
    return (a && b && a != b && gotgt);
}

function updateButtons() {
    var models = [];
    var jqmodels = $();
    $("select[name=cmodel]").each(function(i, elem) {
        if (parseInt($(elem).val()) > 0) {
            models.push($(elem).val());
            jqmodels.push(elem);
        }
    });
    models = $.unique(models);
    var gotmodels = models.length == jqmodels.length && models.length > 1;
    var gotgt = $("input.ground_truth_enabled[@type=checkbox][checked]").length;
    $("#submit_new_comparison_form, #tabs_2_next").attr("disabled", !(gotmodels && gotgt));
    $("#tabs").tabs((gotmodels && gotgt) ? "enable" : "disable", 1);
};


$(function() {
    $("select[name=cmodel], .ground_truth_enabled").change(function(event) {
        updateButtons();
    });

    $("#submit_new_comparison_form").click(function(event) {
        return validateForm();
    })

    $("#tabs").tabs( { disabled: [2], } );
    
    // make steps into tabs
    $(".next_tab").click(function(event) {
        var tabid = $(this).attr("id").replace(/_next/, "_link");
        $("#" + tabid).trigger("click");
    });

    updateButtons();
});
