// Function to build the lang & char models selects when
// the engine type is changed.
function rebuildModelLists(elem) {
    var appname = $(elem).val();
    var cmodel = $(elem).closest("fieldset").find("select[id$=cmodel]").first();
    var lmodel = $(elem).closest("fieldset").find("select[id$=lmodel]").first();

    var opt = $("<option />");
    var copt = cmodel.val();
    var lopt = lmodel.val();

    $.get(
        "/ocrmodels/search",
        { app: appname },
        function(response) {
            cmodel.html("");
            lmodel.html("");
            $.each(response, function(index, item) {
                var select = item.fields.type == "char"
                    ? cmodel
                    : lmodel;

                var newopt = opt.clone()
                        .text(item.fields.name)
                        .attr("value", item.fields.name);
                if (item.fields.name == copt) {
                    newopt.attr("selected", "selected");
                }
                select.append(newopt);
            });
        }
    );
}



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

    gotmodels = true;
    $("#submit_new_comparison_form, #tabs_2_next").attr("disabled", !(gotmodels && gotgt));
    $("#tabs").tabs((gotmodels && gotgt) ? "enable" : "disable", 1);
};


$(function() {
    // decorate engine button toggle
    $("div[id$=engine]").buttonset();
    
    // update each item's models when engine changes
    $("input[name$=engine]").change(function(e) {
        rebuildModelLists(this);
    });


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

    $("input[name$=engine]:checked").each(function(i, elem) {
        rebuildModelLists(elem);
    });
});
