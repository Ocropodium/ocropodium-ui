
$(function() {

    var bsplit = $("body").layout({
        //applyDefaultStyles: true,
        center: {
            resizable: false,
            closable: false, 
        },
    });

    var vsplit = $("#vsplitter").layout({
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0, 
        },
        east: {
            size: 400,
        }        
    });

    var hsplit = $("#sidebar").layout({
        applyDefaultStyles: true,
        north: {
            resizable: false,
            closable: false,
            slidable: false,
            spacing_open: 0, 
        },
        south: {
            size: 200,
        },                   


    });

    $(window).resize();
});
