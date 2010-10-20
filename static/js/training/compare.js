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
    $("#submit_new_comparison_form").attr("disabled", !(gotmodels && gotgt));
    $("#tabs").tabs(gotmodels ? "enable" : "disable", 1);
};


function renumberParameterSets() {
    $(".ocr_parameter_set").each(function(index, elem) {
        var newprefix = "p" + index + "_";
        var newtitle = "Settings P" + index;
        if ($(elem).find("legend").text() != newtitle) {
            $(elem).find("label").each(function(i, child) {
                $(child)
                    .attr("for", $(child).attr("for").replace(/^p\d+_/, newprefix));
            });
            $(elem).find("input, select").each(function(i, child) {
                $(child)
                    .attr("id", $(child).attr("id").replace(/^p\d+_/, newprefix))
                    .attr("name", $(child).attr("name").replace(/^p\d+_/, newprefix));
            });
            $(elem).find("legend").text(
                $(elem).find("legend").text().replace(/Settings P\d+/, newtitle)
            );
            rebuildModelLists($("select[name=$engine]"));
        }
    });
}


function copyParameterSet(pset) {
    var newpset = pset.clone().hide();
    newpset.insertAfter(pset).slideDown();
    renumberParameterSets();
    if ($(".ocr_parameter_set").length > 2) {
        $(".del_paramset").button("enable");
    }
}

function removeParameterSet(pset) {
    pset.remove();
    renumberParameterSets();
    if ($(".ocr_parameter_set").length == 2) {
        $(".del_paramset").button("disable");
    }
}


function setupForm () {
    $(".add_paramset").button({
        icons: {
            primary: "ui-icon-plus",
        },
        text: false,        
    }).live("click", function(event) {
        copyParameterSet($(this).parent());    
    });

    $(".del_paramset").button({
        icons: {
            primary: "ui-icon-minus",
        },
        text: false,
        disabled: true,        
    }).live("click", function(event) {
        removeParameterSet($(this).parent());    
    });

    // update each item's models when engine changes
    $("select[name$=engine]").live("change", function(e) {
        rebuildModelLists(this);
    });


    $("select[name=cmodel], .ground_truth_enabled").live("change", function(event) {
        updateButtons();
    });

}

$(function() {

    setupForm();

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

    $("select[name$=engine]").each(function(i, elem) {
        rebuildModelLists(elem);
    });
});
