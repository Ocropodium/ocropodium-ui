
var FileListWidget = AbstractListWidget.extend({
    constructor: function(parent, datasource, options) {
        this.base(parent, datasource, options);
    },

    setupEvents: function() {
        this.base();
        var self = this;
        $(window).bind("keydown.dirnav", function(event) {
            if (event.keyCode == KC_BACKSPACE) {
                self.dataSource().backDir();                
                event.preventDefault();
            }
        });
    },

    rowDoubleClicked: function(event, row) {
        var row = $(event.target).parent();
        if (row.data("type") == "dir") {
            this.dataSource().setCwd(row.data("name"));
            this.clearSelection();
        }
    },
});





