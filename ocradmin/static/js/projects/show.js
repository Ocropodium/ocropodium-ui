// Browser for opening projects
function validateProjectForm(scope) {
    var bad = $.trim($("#id_name", scope).val()) == "";
    $("#submit_new_project_form", scope).attr("disabled", bad);
}


$(function() {
    $("#tabs").tabs({cookie: {expires: 15}});
    $("#id_name", $("#tabs")).bind("keyup", function(event) {
        validateProjectForm($("#tabs"));
    });
    validateProjectForm($("#tabs"))
});
