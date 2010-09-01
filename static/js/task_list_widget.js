// task list widget

function TaskListWidget(parent, datasource, options) {
    this.init(parent, datasource, options);

}

TaskListWidget.prototype = new AbstractListWidget();
TaskListWidget.constructor = TaskListWidget;

TaskListWidget.prototype.setupEvents = function() {
    var self = this;
}

// FIXME: Hack to allow the task list to maximise properly
// This whole method needs to be removed - it allows overrides
// the default (which returns this.parent) with the widget container
// the layout function needs - horrible.
TaskListWidget.prototype.container = function() {
    return $(this.parent);
}


TaskListWidget.prototype.rowDoubleClicked = function(event, row) {
    var pk = $(event.target).parent().data("pk");
    var dialog = $("<div></div>")
        .attr("id", "dialog")
        .appendTo($("body"))
        .dialog({
            width: 700,
            height: 500,
            modal: true,
            title: "Job Details",
            close: function(e, ui) {
                $(this).remove();
            },
        });
    $.ajax({
        url: "/ocrtasks/show/" + pk + "/",
        dataType: "html",
        success: function(data) {
            dialog
                .html(data).tabs();
        },
    });
}



