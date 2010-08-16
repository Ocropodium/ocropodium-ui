$(function() {

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
