$(document).ready(function() {
    $("li.success").slideDown(3000).delay(1000).fadeOut();
//    $(".delete_project_link").live("click", function(e) {
//        return confirm("Are you sure you want to delete this project?");
//    }); 
    
    // filter table by tags
    $(".project_tag_link").live("click", function(e) {
        $("#projectlist").load($(this).attr("href"));
        return false;            
    });

    // sort table on headers
    $(".sort_table").live("click", function(e) {
        $("#projectlist").load($(this).attr("href")); 
        return false;
    });


    // show new & edit forms in a dialog...
//    $(".show_project_link, .edit_project_link").live("click", function(e) {
//            $("#dialog_box").dialog(
//                {width:600, height:500, title: $(this).attr("title")}
//            ).load($(this).attr("href"));
//            return false;
//    });

    // Ajaxify cancel button    
    $("#cancel_new_project_form, #cancel_edit_project_form").live("click", function(e) {
        $("#dialog_box").dialog("destroy");
        return false;
    });
});

