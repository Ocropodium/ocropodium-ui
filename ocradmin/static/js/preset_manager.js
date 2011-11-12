//
// Preset manager class.  Holds a reference to the current
// preset and manages saving, updating, or clearing it.
// This is trickier than it sounds due to all the Async-ness.
//

// shortcut function for clearing form
$.fn.clearForm = function() {
    return this.each(function() {
        var type = this.type, tag = this.tagName.toLowerCase();
        if (tag == 'form')
            return $(':input',this).clearForm();
        if (type == 'text' || type == 'password' || tag == 'textarea')
            this.value = '';
        else if (type == 'checkbox' || type == 'radio')
            this.checked = false;
        else if (tag == 'select')
            this.selectedIndex = -1;
    });
};

var OcrJs = OcrJs || {};

OcrJs.PresetManager = OcrJs.Base.extend({
    init: function(parent, state) {
        this._super(parent);
        this.parent = parent;

        this.state = state;
        this._presetitem = $.template("#openDialogItem");
        this._dialog = $("#dialog", this.parent);
        this._listeners = {
            saveDialogOpen: [],
            saveDialogClose: [],
            openDialogOpen: [],
            openDialogClose: [],
            openPreset: [],
            newPreset: [],
        };

        // flag telling us we should continue to
        // do something after the current dialog
        this._continueaction = null;

        this.setupEvents();
    },

    setupEvents: function() {
        var self = this;

        $("#new_script, #new_script_button").click(function(event) {
            self.newPreset();
        });
        
        $("#save_script, #save_script_button").click(function(event) {
            if (self.state.getOpen()) {
                self.saveExistingPreset(self.state.getOpen(),
                    self.state.getTreeScript(), function(data) {
                        self.setCurrentOpenPreset(self.state.getOpen(),
                                self.state.getName(), data, false);
                    });
            } else {
                self.showCreatePresetDialog();
            }
        });
        
        $("#save_script_as, #submit_save_script_as").click(function(event) {
            self.showCreatePresetDialog();
        });
        
        $("#open_script").click(function(event) {
            self.showOpenPresetDialog();
        });
        
        $("#download_script").click(function(event) {
            $("#fetch_script_slug").val(self.state.getCurrentSlug());
            $("#fetch_script_data").val(self.state.getTreeJSON());
            $("#fetch_script").submit();
        });

        $("#cancel_dialog").live("click", function(event) {
            self._dialog.dialog("close");
            event.stopPropagation();
            event.preventDefault();
        });

        $("#create_preset").find("input[type='text']").keyup(function(event) {
            self.validateNewForm();
        }).end().find("#submit_create_new").click(function(event) {
            event.preventDefault();
            event.stopPropagation();
            var currdata = self.state.getTreeScript();
            self.saveCreatedPreset({
                    name: self._dialog.find("#id_name").val(),
                    tags: self._dialog.find("#id_tags").val(),
                    description: self._dialog.find("#id_description").val(),
                    user: self._dialog.find("#id_user").val(),
                    public: self._dialog.find("#id_public").prop("checked"),
                    profile: self._dialog.find("#id_profile").val(),
                    data: JSON.stringify(currdata, null, 2),
            }, function(data) {
                    self.setCurrentOpenPreset(data,
                            self._dialog.find("#id_name").val(), currdata, false);
                    self.refreshPresetList(function(data) {
                        self._dialog.dialog("close");
                        if (self._continueaction)
                            self._continueaction();
                    });
                },
                OcrJs.ajaxErrorHandler
            );
        });
        $("#submit_save_script").click(function(event) {
            var data = self.state.getTreeScript();
            self.saveExistingPreset(self.state.getOpen(), data, function(data) {
                self.setCurrentOpenPreset(self.state.getOpen(), self.state.getName(), data, false);
                self._dialog.dialog("close");
                if (self._continueaction)
                    self._continueaction.apply(self)
            }, OcrJs.ajaxErrorHandler);
        });
        
        $("#submit_save_script_as").click(function(event) {
            self.showCreatePresetDialog();
        });
        
        $("#submit_close_without_saving").click(function(event) {
            console.log("Abandoned changes!");
            self.state.clear();
            self._dialog.dialog("close");
            if (self._continueaction)
                self._continueaction.apply(self);
        });

        $("#open_preset_list").selectable({
            selected: function(event, ui) {
                self.validateOpenSelection();
            },
        }).find("li").textOverflow("...", true).dblclick(function(event) {
            self._openPresetFromList($(this));
        });

        $("#open_preset").find("input[type='submit']").click(function(event) {
            var item =  $("#open_preset").find(".preset_item.ui-selected").first();
            self._openPresetFromList(item);
        });
    },

    refreshPresetList: function(successfunc) {
        var self = this;
        $.ajax({
            url: "/presets/list/?format=json",
            dataType: "json",
            data: {format: "json", paginate_by: -1},
            success: function(data) {
                var list = $("#open_preset_list");
                list.children().remove();
                $.each(data, function(i, preset) {
                    list.append($.tmpl(self._presetitem, {
                        fields: preset.fields,
                        num: i+1,
                    }));
                });
                successfunc.apply(self, [data]);
            },
            error: OcrJs.ajaxErrorHandler,
        });
    },

    newPreset: function() {
        console.log("New preset...");
        if (this.state.isDirty()) {
            this._continueaction = this.newPreset;
            this.showUnsavedPresetDialog(this.state.getOpen() == null);
            return;
        }
        this.trigger("newPreset");
        this.state.clear();
        this._continueaction = null;
    },

    setCurrentOpenPreset: function(slug, name, data, reload) {
        this.state.setOpen(slug, name);
        if (reload) {
            this.state.setScript(data);
        }
    },

    showOpenPresetDialog: function() {
        var self = this;
        console.log("Showing open preset dialog...");

        if (this.state.isDirty()) {
            this._continueaction = this.showOpenPresetDialog;
            this.showUnsavedPresetDialog(this.state.getOpen() == null);
            return;
        }
        this._openDialog($("#open_preset"));
    },

    _openPresetFromList: function(item) {
        var self = this;
        var slug = item.data("slug");
        console.log("Opening preset", item);
        this.openPreset(slug, function(data) {
            self.trigger("openPreset");
            self.setCurrentOpenPreset(slug, $.trim(item.text()), data, true);
            self._dialog.dialog("close");
            self._continueaction = null;
        }, OcrJs.ajaxErrorHandler);
    },

    _openDialog: function(elem) {
        var self = this;
        this._dialog.dialog("close");
        this._dialog = elem;
        var tb = $(this.parent);
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
            modal: true,
            position: pos,
            width: tb.width(),
            close: function(e, ui) {
                self.trigger("saveDialogClose");
            },
        });
    },

    showUnsavedPresetDialog: function(saveas) {
        console.log("Showing unsaved preset dialog...");
        this._openDialog($("#unsaved_preset"));
        this._dialog.find("#submit_save_script").attr("disabled", saveas);
    },

    showCreatePresetDialog: function() {
        console.log("Showing create preset dialog...");
        $("#new_preset_form").clearForm();
        this._openDialog($("#create_preset"));
        this.trigger("saveDialogOpen");
    },

    validateOpenSelection: function() {
        var selection = this._dialog.find(".preset_item.ui-selected");
        var submit = this._dialog.find("#submit_open_preset");
        submit.attr("disabled", selection.length != 1);
    },

    validateNewForm: function() {
        var namefield = this._dialog.find("#id_name");
        var submit = this._dialog.find("#submit_create_new");
        submit.attr("disabled", $.trim(namefield.val()) == "");
    },

    saveExistingPreset: function(slug, script, successfunc, errorfunc) {
        if (!script || $.map(script, function(k,v){ return k;}).length == 0)
            throw "Attempt to save existing preset with no data! " + slug;
        $.ajax({
            url: "/presets/update_data/" + slug,
            data: {
                data: JSON.stringify(script, null, 2),
            },
            type: "POST",
            error: errorfunc,
            success: successfunc,
        });
    },

    saveCreatedPreset: function(formdata, successfunc, errorfunc) {
        if (!formdata.data || $.map(formdata.data, function(k,v){ return k;}).length == 0)
            throw "Attempt to save new preset with no data! " + formdata.name;
        $.ajax({
            url: "/presets/createjson/",
            type: "POST",
            data: formdata,
            error: errorfunc,
            statusCode: {
                200: function(errdata) {
                    console.error("200", errdata);
                },
                201: function() {
                    successfunc.apply(null, arguments);
                },
            },
        });
    },

    openPreset: function(slug, successfunc, errorfunc) {
        $.ajax({
            url: "/presets/data/" + slug,
            data: {format: "json"},
            success: successfunc,
            error: errorfunc,
        });
    },
});
