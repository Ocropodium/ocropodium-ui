//
// Preset manager class.  Holds a reference to the current
// preset and manages saving, updating, or clearing it.
//

var OCRJS = OCRJS || {};

OCRJS.PresetManager = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(parent, options);
        this.parent = parent;

        this._dialog = $("#dialog", this.parent);
        this._opentmpl = $.template($("#openDialog"));
        this._opentmplitem = $.template($("#openDialogItem"));
        this._updatetmpl = $.template($("#updateDialog"));
        this._createtmpl = $.template($("#createDialog"));

        this._listeners = {
            saveDialogOpen: [],
            saveDialogClose: [],
            openDialogOpen: [],
            openDialogClose: [],
            openScript: [],
        };

        this._opened = null;
        this._openeddata = null;
        this._current = null;

        // flag telling us we should continue to
        // offer the open dialog after the current
        // save dialog
        this._continuewithopen = false;
    },

    setCurrentScript: function(script) {
        console.log("Set current script");                          
        this._current = script;
    },        

    showOpenPresetDialog: function() {
        var self = this;

        if (this._opened && this._current) {
            console.log("Comparing", this._openeddata, this._current);
            if (bencode(this._openeddata) != bencode(this._current)) {
                console.log("Current doesn't equal opened");
                this._continuewithopen = true;
                this.showSavePresetDialog();
                return;
            }
        } else if (this._current) {
            this.showNewPresetDialog();
            this._continuewithopen = true;
            return;
        }           

        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._opentmpl, {}));
        
        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
            position: pos,
            width: tb.width(),
            close: function(e, ui) {
                self._dialog.children().remove();
                self.callListeners("openDialogClose");    
            },
        });
        $.getJSON("/presets/list/", {format: "json"}, function(data) {
            $.each(data, function(i, preset) {
                $("#open_preset_list", self._dialog).append(
                    $.tmpl(self._opentmplitem, preset)
                );
            });
            $("#open_preset_list").selectable({
                selected: function(event, ui) {
                    self.validateOpenSelection();
                },    
            });
        });            
        this._dialog.find("input[type='submit']").click(function(event) {
            var item =  self._dialog.find(".preset_item.ui-selected").first();
            var slug = item.data("slug");
            $.getJSON("/presets/data/" + slug, {format: "json"}, function(data) {
                self._opened = slug;
                self._openeddata = JSON.parse(data);
                self._dialog.dialog("close");
                self._continuewithopen = false;
                self.callListeners("openScript", item.text(), self._openeddata);
            });
            event.preventDefault();
            event.stopPropagation();
        });
    },

    showSavePresetDialog: function() {
        var self = this;        
        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._updatetmpl, {}));

        console.assert(this._opened);
        this._dialog.find("#save_script").click(function(event) {
            self.savePreset(self._opened, self._current, function(data) {
                self._dialog.dialog("close");
                self._openeddata = JSON.parse(data);
                if (self._continuewithopen)
                    self.showOpenPresetDialog();
            }, OCRJS.ajaxErrorHandler);
        });
        this._dialog.find("#save_script_as").click(function(event) {
            self.showNewPresetDialog();
        });
        this._dialog.find("#close_without_saving").click(function(event) {
            console.log("Abandoned changes!");
            self._opened = self._openeddata = self._current = null;            
            self._dialog.dialog("close");
            if (self._continuewithopen)
                self.showOpenPresetDialog();
        });

        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
            position: pos,
            width: tb.width(),
            close: function(e, ui) {
                self._dialog.children().remove();
                self.callListeners("saveDialogClose");    
            },
        });

    },

    showNewPresetDialog: function() {
        var self = this;        
        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._createtmpl, {}));
        this._dialog.find("#id_data").val(JSON.stringify(this._current, null, '\t'));
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
                        if (self._continuewithopen)
                            self.showOpenPresetDialog();
                    },        
                }
            });
            event.preventDefault();
            event.stopPropagation();
        });

        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
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

    validateOpenSelection: function() {
        var selection = this._dialog.find(".preset_item.ui-selected");
        var submit = this._dialog.find("#open_preset");
        submit.attr("disabled", selection.length != 1);
    },                               

    validateNewForm: function() {
        var namefield = this._dialog.find("#id_name");
        var submit = this._dialog.find("#create_new");
        submit.attr("disabled", $.trim(namefield.val()) == "");
    },

    savePreset: function(slug, script, successfunc, errorfunc) {
        $.ajax({
            url: "/presets/update_data/" + slug,
            data: {data: JSON.stringify(script, null, '\t')},
            type: "POST",
            error: errorfunc,
            success: successfunc,
        });                
    },                    
});
