//
// Global ready() functions executed after everything else.
//

"use strict"

var vsplit, bsplit, defaultlayout;

$(function() {
    bsplit = $("body").layout({
        //applyDefaultStyles: true,
        center: {
            resizable: false,
            closable: false,
        },
    });

    defaultlayout = {
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

    var loadstate = $.cookie("panels");
    if (loadstate) {
        var state = JSON.parse(loadstate).vsplit;
        $.extend(defaultlayout.north, state.north);
        $.extend(defaultlayout.east, state.east);
    }

    vsplit = $("#vsplitter").layout(defaultlayout);

    $(window).unload(function() {
        var state = {
            vsplit: vsplit.getState(),
        };
        $.cookie("panels", JSON.stringify(state));
    });

    $(window).resize();
});

