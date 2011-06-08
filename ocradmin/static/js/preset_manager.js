// Preset manager class.  A popup window which handles
// showing and selecting from a list of presets of a
// given type, i.e. "binarize", "segment"

// Note: showing/editing preset description/tags is not
// yet implemented

var OCRJS = OCRJS || {};

OCRJS.PresetManager = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(parent, options);
        this.parent = parent;
        this.setupEvents();

        this._dialog = $("#dialog", this.parent);

        this._listeners = {
            saveDialogOpen: [],
            saveDialogClose: [],
        };
    },

    setupEvents: function() {
        var self = this;        

        $("#save_script", self.parent).click(function(event) {
            if (self._dialog.dialog("isOpen") === true) {
                self._dialog.dialog("close");

                event.stopPropagation();
                return;
            }

            var tb = $(self.parent);        
            var pos = [tb.offset().left, tb.offset().top + tb.height()];
            self._dialog.load("/ocrpresets/create/", function() {
                self._dialog.find("#id_data")
                    .val(JSON.stringify(pbuilder.buildScript()));
//console.log("Set form data:". self._dialog.find("#id_data").val());
                self.handleForm();                    
                self._dialog.dialog({
                    dialogClass: "save_dialog",
                    position: pos,
                    width: tb.width(),
                    close: function(e, ui) {
                        self._dialog.children().remove();
                        self.callListeners("saveDialogClose");    
                    },
                });
            });
            self.callListeners("saveDialogOpen");
            event.stopPropagation();
            event.preventDefault();    
        });
    },

    validateNewForm: function() {
        var self = this;
        var namefield = self._dialog.find("#id_name");
        var submit = self._dialog.find("input[type='submit']");
        submit.attr("disabled", $.trim(namefield.val()) == "");
    },                 

    handleForm: function() {
        var self = this;
        var submit = $("input[type='submit']", self._dialog),
            namefield = $("#id_name", self._dialog),
            stockval = namefield.val(),
            datafield = $("#id_data", self._dialog);                        

        // validate the name
        namefield.keyup(function(event) {
            self.validateNewForm();
        });                 
        // hide the data field and add data from the script
        datafield
            .parent().hide();

        submit.click(function(sevent) {
            $.ajax({
                url: "/ocrpresets/create/",
                type: "POST",
                data: self._dialog.find("form").serialize(),
                error: OCRJS.ajaxErrorHandler,
                statusCode: {
                    200: function() {
                        self.rebuildPresetList(namefield.val());
                        self._dialog.dialog("close");
                    },
                    202: function(data) {
                        self._dialog
                            .html(data);
                        self.handleForm();
                        self.validateNewForm();
                    },
                }
            });
            return false;
        });
    },                 

    rebuildPresetList: function(current) {
        var select = $("#select_script", this.parent);
        $.getJSON("/ocrpresets/list/", {format: "json"}, function(data) {
            select.children().slice(1).remove();
            $.each(data, function(i, preset) {
                var opt = $("<option></option>");
                    opt.attr("value", preset.slug);
                    opt.text(preset.fields.name);
                    opt.attr("title", preset.fields.description);
                if (preset.fields.name == current)
                    opt.prop("selected", "selected");                    
                opt.appendTo(select)
            });
        });
    },
});
