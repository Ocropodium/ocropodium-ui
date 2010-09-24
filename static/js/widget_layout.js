function layoutWidgets() {
    var sidewidget = $("#sideviewer, #sidebar");
    // set the sidewidget to 35% of available space
    //sidewidget.first().css("width", "35%");
    var sideoutwidth = sidewidget.outerWidth(true);

    var availablewidth = $("#workspace").width();
    var wtop = $("#workspace").position().top 
        + $("#menu").outerHeight(true)
        + $(".sub_toolbar").outerHeight(true);
    var wleft = $("#workspace").position().left;
    $(".widget:not(#sideviewer, #sidebar)").each(function(i, widget) {
        var margin = $(widget).outerWidth(true) - $(widget).width();
        $(widget).width(availablewidth - (sideoutwidth + margin))
            .css("position", "absolute")
            .css("top", wtop)
            .css("left", wleft);
        wtop += $(widget).outerHeight(true);

    });
}

function maximiseWidgets() {
    var winheight = $(window).height();
    var margin = 10;
    for (var i in arguments) {
        var widget = arguments[i];
        var container = widget.container();
        var pad = (container.outerHeight(true)
                - container.height()) + $(".widget_header", container).outerHeight(true);
        var top = container.position().top;
        var newheight = winheight - top - pad - margin;
        widget.setHeight(newheight);
    }
}



