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

    $(".score_details").live("click", function(event) {
        var dialog = $("<div></div>")
            .attr("id", "dialog")
            .appendTo($("body"))
            .load($(this).attr("href"), function() {
                $("#scoretabs", dialog).tabs();    
            })
            .dialog({
                width: 600,
                height: 500,
                modal: true,
                title: "Model Score Details",
                close: function() {
                    dialog.remove();
                },
            });
        event.preventDefault();
    });

    // remove some superfluous data in the lists to make the table
    // easier to read, i.e. only show the first page for the given
    // set of scores.
    var lastpagename;
    $(".training_page_name").each(function(i, elem) {
        if (!lastpagename) {
            lastpagename = $(elem).text();
        } else {
            if (lastpagename == $(elem).text()) {
                $(elem).text("");
            } else {
                lastpagename = $(elem).text();
            }
        }
    });

    refreshData();    
});
