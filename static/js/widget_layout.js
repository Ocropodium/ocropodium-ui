function layoutWidgets() {
    var sidewidget = $("#sideviewer, #sidebar");
    // set the sidewidget to 35% of available space
    //sidewidget.first().css("width", "35%");
    var sideoutwidth = sidewidget.outerWidth(true);

    var availablewidth = $("#workspace").width();
    var wtop = $("#workspace").position().top;
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

function maximiseVertical() {


}

