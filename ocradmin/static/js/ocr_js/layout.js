// 
// jQuery.layout configuration
//

var bodysplit = null,
    pagesplit = null,
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


    var menupanelayout = {
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

    $("#page").layout(menupanelayout);
    $("#widget").layout(widgetlayout);
    $("#sidebar").layout(widgetlayout);

    $("#widgetcontent").layout(innerlayout);
    $("#sidebarcontent").layout(innerlayout);
    $(".toolpane").layout(innerlayout);
});

