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

        this._dialog = $("#dialog", this.parent);
        this._updatetmpl = $.template($("#updateDialog"));
        this._createtmpl = $.template($("#createDialog"));

        this._listeners = {
            saveDialogOpen: [],
            saveDialogClose: [],
        };
    },

    showNewPresetDialog: function(scriptdata) {

        var self = this;        
        if (this._dialog.dialog("isOpen") === true) {
            this._dialog.dialog("close");

            event.stopPropagation();
            return;
        }

        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._createtmpl, {}));
        this._dialog.find("input[type='text']").keyup(function(event) {
            self.validateNewForm();
        });
        this._dialog.find("input[type='submit']").click(function(event) {
            var name = self._dialog.find("#id_name").val();
            $.ajax({
                url: "/presets/create/",
                type: "POST",
                data: self._dialog.find("form").serialize(),
                error: OCRJS.ajaxErrorHandler,
                statusCode: {
                    200: function(data) {
                        // FIXME: Assume something actually worked here... if
                        // it fails we'll get another form, but it's fiddly
                        // to distinguish from the redirect response
                        self._dialog.dialog("close");
                        self.rebuildPresetList(name);
                    },        
                }
            });
            event.preventDefault();
            event.stopPropagation();
        });
        this._dialog.find("#id_data").val(scriptdata);

        this._dialog.dialog({
            dialogClass: "save_dialog",
            position: pos,
            width: tb.width(),
            close: function(e, ui) {
                self._dialog.children().remove();
                self.callListeners("saveDialogClose");    
            },
        });
        this.callListeners("saveDialogOpen");
        event.stopPropagation();
        event.preventDefault();    
    },

    validateNewForm: function() {
        console.log("validating");                         
        var namefield = this._dialog.find("#id_name");
        var submit = this._dialog.find("#create_new");
        submit.attr("disabled", $.trim(namefield.val()) == "");
    },                 

    rebuildPresetList: function(current) {
        var select = $("#select_script", this.parent);
        $.getJSON("/presets/list/", {format: "json"}, function(data) {
            select.children().slice(1).remove();
            $.each(data, function(i, preset) {
                var opt = $("<option></option>");
                    opt.attr("value", preset.fields.slug);
                    opt.text(preset.fields.name);
                    opt.attr("title", preset.fields.description);
                if (preset.fields.name == current)
                    opt.prop("selected", "selected");                    
                opt.appendTo(select)
            });
        });
    },
});
