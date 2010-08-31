// task list widget

function TaskListWidget(parent, datasource, options) {
    this.init(parent, datasource, options);

}

TaskListWidget.prototype = new AbstractListWidget();
TaskListWidget.constructor = TaskListWidget;

TaskListWidget.prototype.setupEvents = function() {
    var self = this;
}


TaskListWidget.prototype.rowDoubleClicked = function(event, row) {
    var row = $(event.target).parent();
}



