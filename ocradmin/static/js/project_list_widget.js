// Project list widget

var ProjectListWidget = AbstractListWidget.extend({
    init: function(parent, datasource, options) {
        this._super(parent, datasource, options);
    },

    project: function() {
        return $(".ui-selected", this.parent).first().data("pk");
    },

    setupEvents: function() {
        this._super();
        var self = this;

        $(window).bind("keydown.enteropen", function(event) {
            if (event.keyCode == KC_RETURN) {
                if (self.project()) {
                    $("#fbopenbutton").click();
                }
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

    teardownEvents: function() {
        $(window).unbind("keydown.enteropen");
        $("#fbopenbutton, #fbclosebutton").unbind("click");
        this._super();
    },

    buildUi: function() {
        // add a couple of buttons at the botton of the window
        var container = $("<div></div>")
            .append(this._super())  // append base class UI
            .append(
                $("<div></div>")
                    .addClass("buttoncontrols")
                    .append(
                        $("<input></input>")
                            .attr("type", "button")
                            .attr("id", "fbopenbutton")
                            .attr("value", "Open Project")
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
        this._super();                          
        var row = $(event.target).parent();
        $("#fbopenbutton").click();           
    },

    rowClicked: function(event, row) {
        this._super();
        $("#fbopenbutton").attr(
                "disabled", $(".ui-selected", this.parent).length == 0);
    },

    open: function(event) {

    },

    close: function(event) {
    
    },               
});



