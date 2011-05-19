var batchlist = null;


function saveState() {
    var order_by = document.filter.order_by.value;
    var user = document.filter.batch__user__pk.value;
    var stat = $.map(document.filter.status, function(cb) {
        if (cb.checked) {
            return cb.value;
        }
    }).join(",");
    var autorf = document.controls.autorefresh.checked;
    var autorf_time = document.controls.autorefresh_time.value;

    var winprefix = window.location.pathname.replace(/\//g, "");
    $.cookie(winprefix + "_order_by", order_by);
    $.cookie(winprefix + "_user", user);
    $.cookie(winprefix + "_stat", stat);
    $.cookie(winprefix + "_autorf", autorf);
    $.cookie(winprefix + "_autorf_time", autorf_time);
}

function loadState() {
    var winprefix = window.location.pathname.replace(/\//g, "");
    var order_by = $.cookie(winprefix + "_order_by");
    var user = $.cookie(winprefix + "_user");
    var stat = $.cookie(winprefix + "_stat");
    var autorf = $.cookie(winprefix + "_autorf");
    var autorf_time = $.cookie(winprefix + "_autorf_time");

    if (order_by) {
        document.filter.order_by.value = order_by;
    }
    if (user) {
        document.filter.batch__user__pk.value = user;
    }
    if (stat) {
        $.each(stat.split(","), function(i, s) {
            $("input[value='" + s + "']").prop("checked", true);
        });
    }
    if (autorf) {
        document.controls.autorefresh.checked = (autorf === 'true');
    }
    if (autorf_time) {
        document.controls.autorefresh_time.value = autorf_time;
    }
}


// save state on leaving the page... at least try to...
window.onbeforeunload = function(event) {
    saveState();
}


$(function() {
    
    //loadState();
    //tasks = new TaskList("task_list", "task_filter_form");
    //tasks.init();

    $("#batch_list_widget").resizable({
        resize: function(e, ui) {
            batchlist.setHeight($(this).height() - 80);
            batchlist.resized();
        },        
    });

    batchlist = new BatchListWidget(
        $("#batch_list").get(0), 
        new BatchDataSource(),
        {
            multiselect: true,
        }
    );
    batchlist.setupEvents();
    
    // FIXME!  Get rid of this overridden hacked function
    function maximiseWidgets() {
        var winheight = $(window).height();
        var margin = 10;
        for (var i in arguments) {
            var widget = arguments[i];
            var container = widget.container();
            var pad = container.outerHeight(true) - container.height();
            var top = container.position().top;
            var newheight = winheight - top - pad - margin;
            widget.setHeight(newheight - 80);
        }
    }

    maximiseWidgets(batchlist);
});



