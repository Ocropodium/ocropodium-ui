function validateProjectForm() {
    var bad = $.trim($("#id_name").text()) == "";
    $("submit_new_project").attr("disabled", bad);
}


$(function() {

    $("#id_name").bind("keyup", function(event) {
        validateProjectForm();
    });

    $("legend.collapsed").next().hide();
    $("legend.collapsed, legend.expanded").click(function(e) {
        if ($(this).hasClass("collapsed")) {
            $(this)
                .removeClass("collapsed")
                .addClass("expanded")
                .next().show();
        } else {
            $(this)
                .removeClass("expanded")
                .addClass("collapsed")
                .next().hide();
        }
    });


});
