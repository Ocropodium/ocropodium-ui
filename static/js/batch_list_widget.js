// task list widget

function BatchListWidget(parent, datasource, options) {
    this.init(parent, datasource, options);

}

BatchListWidget.prototype = new AbstractListWidget();
BatchListWidget.constructor = BatchListWidget;

BatchListWidget.prototype.setupEvents = function() {
    var self = this;
}

// FIXME: Hack to allow the task list to maximise properly
// This whole method needs to be removed - it allows overrides
// the default (which returns this.parent) with the widget container
// the layout function needs - horrible.
BatchListWidget.prototype.container = function() {
    return $(this.parent);
}


BatchListWidget.prototype.rowDoubleClicked = function(event, row) {
    var pk = $(event.target).parent().data("pk");
    document.location.pathname = "/batch/show/" + pk + "/";
}



