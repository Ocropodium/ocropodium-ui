// 
// jQuery.layout configuration
//

var bodysplit = null,
    pagesplit = null,
    widgetsplit = null,
    sidesplit = null,
    widgetcontentsplit = null,
    sidecontentsplit = null;


$(function() {
    

    bodysplit = $("body").layout({
        //applyDefaultStyles: true,
        center: {
            resizable: false,
            closable: false,
        },
    });


    var menupanellayout = {
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
            size: 200,
            resizable: false,
            closable: false,
            slidable: false,
            initClosed: true,
        },
    };

    var innersidebarlayout = {
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0,
        },
        south: {
            size: 200,
        }
    };

    var loadstate = $.cookie("panels");
    if (loadstate) {
        var state = JSON.parse(loadstate),
            pageid = window.location.pathname.replace("/$", "");
        if (state && state[pageid]) {
            $.extend(menupanellayout.east, state[pageid].east);
        }
    }

    $(window).unload(function() {
        console.log("Unloading");
        var pageid = window.location.pathname.replace("/$", "");
            statestr = $.cookie("panels"),
            state = {};
        if (statestr)
            state = JSON.parse(statestr);
        
        state[pageid] = pagesplit.getState();
        $.cookie("panels", JSON.stringify(state));
    });

    pagesplit = $("#page").layout(menupanellayout);
    widgetsplit = $("#widget").layout(widgetlayout);
    sidesplit = $("#sidebar").layout(widgetlayout);

    widgetcontentsplit = $("#widgetcontent").layout(innerlayout);
    sidecontentsplit = $("#sidebarcontent").layout(innersidebarlayout);
    toolpanesplits = $(".toolpane").layout(innerlayout);
    pagesplit.options.center.onresize_end = function() {
        widgetsplit.resizeAll();
        sidesplit.resizeAll();
        layoutmanager.trigger("layoutChanged");
    }
    
    widgetcontentsplit.options.center.onresize_end = function() {
        layoutmanager.trigger("layoutChanged");
    }
    sidecontentsplit.options.center.onresize_end = function() {
        layoutmanager.trigger("layoutChanged");
    }


    layoutmanager.trigger("initialised");
});

