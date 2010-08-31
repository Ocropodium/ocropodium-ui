
function FileBrowser2(parent, datasource, options) {
    this.init(parent, datasource, options);

}

FileBrowser2.prototype = new AbstractListWidget();
FileBrowser2.constructor = FileBrowser2;

FileBrowser2.prototype.setupEvents = function() {
    var self = this;
    $(window).bind("keydown", function(event) {
        if (event.keyCode == 8) {
            self.dataSource().backDir();
        }
    });
}


FileBrowser2.prototype.rowDoubleClicked = function(event, row) {
    var row = $(event.target).parent();
    if (row.data("type") == "dir") {
        this.dataSource().setCwd(row.data("name"));
        this.clearSelection();
    }
}




