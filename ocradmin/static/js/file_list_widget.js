
var FileListWidget = AbstractListWidget.extend({
    constructor: function(parent, datasource, options) {
        this.base(parent, datasource, options);
    },

    files: function() {
        return $.map($(".selected.file"), function(elem, i) {
            return $(elem).data("value");    
        });
    },

    setupEvents: function() {
        this.base();
        var self = this;
        $(window).bind("keydown.dirnav", function(event) {
            if (event.keyCode == KC_BACKSPACE) {
                self.dataSource().backDir();                
                event.preventDefault();
            } else {
                return true;
            }
        });

        $("#fbopenbutton").click(function() {
            self.open();
        });

        $("#fbclosebutton").click(function() {
            self.close();
        });        
    },

    buildUi: function() {
        // add a couple of buttons at the botton of the window
        var container = $("<div></div>")
            .append(this.base())  // append base class UI
            .append(
                $("<div></div>")
                    .addClass("buttoncontrols")
                    .append(
                        $("<input></input>")
                            .attr("type", "button")
                            .attr("id", "fbopenbutton")
                            .attr("value", "Open")
                            .attr("disabled", true)
                    ).append(
                        $("<input></input>")
                            .attr("type", "button")
                            .attr("id", "fbclosebutton")
                            .attr("value", "Cancel")
                    )
               );

        return container;
    },

    rowDoubleClicked: function(event, row) {
        this.base();                          
        var row = $(event.target).parent();
        if (row.data("type") == "dir") {
            this.dataSource().setCwd(row.data("name"));
            this.clearSelection();
        } else {
            $("#fbopenbutton").click();           
        }
    },

    rowClicked: function(event, row) {
        this.base();
        $("#fbopenbutton").attr(
                "disabled", $(".selected.file", this.parent).length == 0);
    },

    open: function(event) {

    },

    close: function(event) {
    
    },               
});





