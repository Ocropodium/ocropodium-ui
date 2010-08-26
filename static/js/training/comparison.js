// JS for comparison.html

function refreshData() {
    if ($("h3.inprogress").length) {
        setTimeout(function() {
            $(".widget_content").load(window.location.pathname);
            refreshData();
        }, 1000);
    }
}

$(function() {
    refreshData();    
});
