//
// Global ready() functions executed after everything else.
//

"use strict"

//var vsplit, bsplit, defaultlayout, widgetlayout;
$(function() {
    // add csrf protect token, as per:
    // https://docs.djangoproject.com/en/dev/ref/contrib/csrf/
    $(document).ajaxSend(function(event, xhr, settings) {
        function getCookie(name) {
            var cookieValue = null;
            if (document.cookie && document.cookie != '') {
                var cookies = document.cookie.split(';');
                for (var i = 0; i < cookies.length; i++) {
                    var cookie = jQuery.trim(cookies[i]);
                    // Does this cookie string begin with the name we want?
                    if (cookie.substring(0, name.length + 1) == (name + '=')) {
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        }
        function sameOrigin(url) {
            // url could be relative or scheme relative or absolute
            var host = document.location.host; // host + port
            var protocol = document.location.protocol;
            var sr_origin = '//' + host;
            var origin = protocol + sr_origin;
            // Allow absolute or scheme relative URLs to same origin
            return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
                (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
                // or any other URL that isn't scheme relative or absolute i.e relative.
                !(/^(\/\/|http:|https:).*/.test(url));
        }
        function safeMethod(method) {
            return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
        }

        if (!safeMethod(settings.type) && sameOrigin(settings.url)) {
            xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
        }
    });

    //bsplit = $("body").layout({
    //    //applyDefaultStyles: true,
    //    center: {
    //        resizable: false,
    //        closable: false,
    //    },
    //});

    //defaultlayout = {
    //    applyDefaultStyles: true,
    //    north: {
    //        resizable: false,
    //        closable: false,
    //        slidable: false,
    //        spacing_open: 0,
    //    },
    //    south: {
    //        resizable: false,
    //        closable: false,
    //        slidable: false,
    //        spacing_open: 0,
    //    },
    //    east: {
    //        size: 400,
    //    }
    //};

    //widgetlayout = {
    //    applyDefaultStyles: true,
    //    north: {
    //        resizable: false,
    //        closable: false,
    //        slidable: false,
    //        spacing_open: 0,
    //    },
    //};


    //var loadstate = $.cookie("panels");
    //if (loadstate) {
    //    var state = JSON.parse(loadstate).vsplit;
    //    $.extend(defaultlayout.north, state.north);
    //    $.extend(defaultlayout.east, state.east);
    //}

    //vsplit = $("#vsplitter").layout(defaultlayout);

    //var mainsplit, sidesplit;
    //setTimeout(function() {
    //    mainsplit = $("#mainwidget").layout(widgetlayout);
    //    sidesplit = $("#sidebarwidget").layout(widgetlayout);
    //});

    //vsplit.options.east.onresize_end = function() {
    //    if (mainsplit) {
    //        mainsplit.resizeAll();
    //        sidesplit.resizeAll();
    //    }
    //};
    //vsplit.options.center.onresize_end = function() {
    //    if (mainsplit) {
    //        mainsplit.resizeAll();
    //        sidesplit.resizeAll();
    //    }
    //};

    //$(window).unload(function() {
    //    var state = {
    //        vsplit: vsplit.getState(),
    //    };
    //    $.cookie("panels", JSON.stringify(state));
    //});

    //$(window).resize();
});

