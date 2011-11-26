$(document).ready(function() {
    $("li.success").slideDown(3000).delay(1000).fadeOut();
    $(".delete_model_link").live("click", function(e) {
        return confirm("Are you sure you want to delete this model?");
    });
    
    // filter table by tags
    $(".model_tag_link").live("click", function(e) {
        $("#modellist").load($(this).attr("href"));
        return false;
    });

    // sort table on headers
    $(".sort_table").live("click", function(e) {
        $("#modellist").load($(this).attr("href"));
        return false;
    });


    // show new & edit forms in a dialog...
    $(".show_model_link, .edit_model_link").live("click", function(e) {
            $("#dialog_box").dialog({
                width:600,
                height:500,
                title: $(this).attr("title"),
                close: function() {
                    $("#dialog_box").html("");
                }
            }).load($(this).attr("href"));
            return false;
    });

    // Ajaxify cancel button
    $("#cancel_new_model_form, #cancel_edit_model_form").live("click", function(e) {
        $("#dialog_box").dialog("destroy");
        return false;
    });
});

