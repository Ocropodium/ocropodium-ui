// Browser for opening projects
function validateProjectForm(scope) {
    var bad = $.trim($("#id_name", scope).val()) == "";
    $("#submit_new_project_form", scope).attr("disabled", bad);
}

var pbrowser = null;

// global opener hook
$(function() {
    $("#open_project").click(function(event) {
        var dialog = $("<div></div>")
            .attr("id", "project_dialog")
            .appendTo($("body"));
        pbrowser = new ProjectListWidget(
            dialog.get(0), 
            new ProjectDataSource(),
            {multiselect: false}
        );
        pbrowser.open = function() {
            var pk = pbrowser.project();
            window.location.pathname = "/projects/load/" + pk + "/";
        }
        pbrowser.close = function() {
            dialog.dialog("close");
        }

        dialog.dialog({
            width: 700,
            minHeight: 300,
            resize: function(e, ui) {
                pbrowser.resized(e);
                pbrowser.setHeight($(this).height());   
            },
            close: function(e) {
                pbrowser.teardownEvents();
                pbrowser = null;
                dialog.remove();
            },            
            modal: true,
        });
        event.preventDefault();
    });

    $("#new_project").click(function(event) {
        var dialog = $("<div></div>")
            .attr("id", "dialog")
            .css("width", "700px")
            .css("height", "500px")
            .dialog({
                width: 700,
                height: 500,
                title: "New Project...",
                close: function() {
                    $(this).remove();
                },
                modal: true,
            }).load("/projects/new/", function() {
                $("#id_name").live("keyup", function(event) {
                    validateProjectForm(dialog);
                });
            });
        event.preventDefault();
    });
});


