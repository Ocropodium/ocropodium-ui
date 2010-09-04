// JS for comparison.html

function refreshData() {
    if ($(".inprogress").length) {
        setTimeout(function() {
            $(".widget_content").load(window.location.pathname, function() {
                $("#tabs").tabs();
            });
            refreshData();
        }, 1000);
    }
}

$(function() {
    $("#tabs").tabs();
    refreshData();    
});
