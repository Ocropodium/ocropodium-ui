// task list widget

var BatchListWidget = AbstractListWidget.extend({
    constructor: function(parent, datasource, options) {
        this.base(parent, datasource, options);
    },

    // FIXME: Hack to allow the task list to maximise properly
    // This whole method needs to be removed - it allows overrides
    // the default (which returns this.parent) with the widget container
    // the layout function needs - horrible.
    container: function() {
        return $(this.parent);
    },

    rowDoubleClicked: function(event, row) {
        var pk = $(event.target).parent().data("pk");
        document.location.pathname = "/batch/show/" + pk + "/";
    },
});



