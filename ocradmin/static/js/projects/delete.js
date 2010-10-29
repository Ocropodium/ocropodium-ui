$(function() {

    $("#id_confirm").bind("keyup", function(event) {
        $("#submit_delete_project_form").attr("disabled", $.trim($("#id_confirm").val()) == "");
    });
});
