var pbuilders = [];

function validateForm() {
    // check at least one groundtruth is selected
    var gotgt = $("input.ground_truth_enabled[@type=checkbox][checked]").length;
    return gotgt;
}

function updateButtons() {
    var gotgt = $("input.ground_truth_enabled[@type=checkbox][checked]").length;
    var gotmodels = true;
    console.log("Gotgt: ", gotgt);
    $("#submit_new_comparison_form").attr("disabled", !(gotmodels && gotgt));
    $("#tabs").tabs(gotmodels ? "enable" : "disable", 1);
};


function renumberParameterSets() {
    $(".ocr_parameter_set").each(function(index, elem) {
        var newprefix = "p" + index + "_";
        var newtitle = "Settings P" + index;
        if ($(elem).find("legend").text() != newtitle) {
            $(elem).find("legend").text(
                $(elem).find("legend").text().replace(/Settings P\d+/, newtitle)
            );
        }
    });
}


function copyParameterSet(pset) {
    var newpset = pset.clone(true).hide();
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

    $("input.ground_truth_enabled").change(updateButtons);

    updateButtons();

    $(".option_box").each(function(i, elem) {
        pbuilders[i] = new OCRJS.ParameterBuilder(elem);
        pbuilders[i].init();
    });

});
