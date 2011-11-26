$(document).ready(function() {
    $("li.success").slideDown(3000).delay(1000).fadeOut();
    // filter table by tags
    $(".sort_table").live("click", function(e) {
        $("#comparisonlist").load($(this).attr("href"));
        return false;
    });


    // show new & edit forms in a dialog...
//    $(".show_comparison_link").live("click", function(e) {
//            $("#dialog_box").dialog({
//                width:600,
//                height:500,
//                title: $(this).attr("title"),
//                close: function() {
//                    $("#dialog_box").html("");
//                }
//            }).load($(this).attr("href"), function() {
//                $("#tabs").tabs();
//            });
//            return false;
//    });
});

