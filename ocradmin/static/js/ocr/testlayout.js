
var bodysplit = null,
    menusplit = null,
    panesplit = null,
    mainsplit = null,
    sidesplit = null;


$(function() {
    

    bodysplit = $("body").layout({
        //applyDefaultStyles: true,
        center: {
            resizable: false,
            closable: false,
        },
    });


    var defaultlayout = {
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0,
        },
        south: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0,
        },
        east: {
            size: 400,
        }
    };

    var widgetlayout = {
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0,
        },
    };

    var innerlayout = {
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0,
        },
        south: {
            size: 100,
        },
    };

    $("#menusplitter").layout(defaultlayout);
    $("#content").layout(widgetlayout);
    $("#sidebar").layout(widgetlayout);

    $("#mainwidget").layout(innerlayout);
    $("#sidebarwidget").layout(innerlayout);


});
