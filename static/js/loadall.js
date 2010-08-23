// ready() functions executed after everything else.
// Mainly for widget layout

$(function() {
    $(window).resize(function(event) {
        layoutWidgets();
    });
    layoutWidgets();
    $(window).trigger("resize");

    $("#workspace").invalidateLayout = function(event) {
        layoutWidgets();            
    }
});

