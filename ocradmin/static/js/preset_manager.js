//
// Preset manager class.  Holds a reference to the current
// preset and manages saving, updating, or clearing it.
//

var OcrJs = OcrJs || {};

OcrJs.PresetManager = OcrJs.Base.extend({
    constructor: function(parent, state) {
        this.base(parent);
        this.parent = parent;

        this.state = state;

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
            openPreset: [],
            newPreset: [],
        };

        // flag telling us we should continue to
        // offer the open dialog after the current
        // save dialog
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
                        self.setCurrentOpenPreset(self.state.getOpen(), self.state.getName(), data, false);
                    });
            } else {
                self.showCreatePresetDialog();
            }
        });        
        
        $("#save_script_as").click(function(event) {
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
    },

    newPreset: function() {
        console.log("New preset...");                   
        if (this.state.isDirty()) {
            this._continueaction = this.newPreset;
            this.showUnsavedPresetDialog(!this._opened);
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
            this.showUnsavedPresetDialog();
            return;
        }

        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._opentmpl, {}));
        
        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
            position: pos,
            width: tb.width(),
            modal: true,
            close: function(e, ui) {
                self._dialog.children().remove();
                self.trigger("openDialogClose");    
            },
        });

        $.getJSON("/presets/list/", {
                format: "json",
                paginate_by: -1,
            }, function(data) {
            console.log("Preset data", data);
            $.each(data, function(i, preset) {
                $("#open_preset_list", self._dialog).append(
                    $.tmpl(self._opentmplitem, preset)
                );
            });
            $("li", "#open_preset_list").textOverflow("...", true);
            $("#open_preset_list").selectable({
                selected: function(event, ui) {
                    self.validateOpenSelection();
                },    
            }).find("li").dblclick(function(event) {
                self._openPresetFromList($(this));
            });
        });            
        this._dialog.find("input[type='submit']").click(function(event) {
            var item =  self._dialog.find(".preset_item.ui-selected").first();
            self._openPresetFromList(item);
        });
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

    showUnsavedPresetDialog: function(saveas) {
        console.log("Showing unsaved preset dialog...");
        var self = this;        
        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._updatetmpl, {}));
        this._dialog.find("#submit_save_script").attr("disabled", saveas);
        this._dialog.find("#submit_save_script").click(function(event) {
            var data = self.state.getTreeScript();
            self.saveExistingPreset(self._opened, data, function(data) {
                self.setCurrentOpenPreset(self._opened, name, data, false);
                self._dialog.dialog("close");
                if (self._continueaction)
                    self._continueaction()
            }, OcrJs.ajaxErrorHandler);
        });
        this._dialog.find("#submit_save_script_as").click(function(event) {
            self.showCreatePresetDialog();
        });
        this._dialog.find("#submit_close_without_saving").click(function(event) {
            console.log("Abandoned changes!");
            self.state.clear();
            self._dialog.dialog("close");
            if (self._continueaction)
                self._continueaction();
        });

        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
            modal: true,
            position: pos,
            width: tb.width(),
            close: function(e, ui) {
                self._dialog.children().remove();
                self.trigger("saveDialogClose");    
            },
        });
    },

    showCreatePresetDialog: function() {
        console.log("Showing create preset dialog...");
        var self = this;        
        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._createtmpl, {}));
        this._dialog.find("input[type='text']").keyup(function(event) {
            self.validateNewForm();
        });
        this._dialog.find("#submit_create_new").click(function(event) {
            event.preventDefault();
            event.stopPropagation();
            var currdata = self.state.getTreeScript();
            self.saveCreatedPreset(
                self._dialog.find("#id_name").val(),
                self._dialog.find("#id_tags").val(),
                self._dialog.find("#id_description").val(),
                self._dialog.find("#id_public").prop("checked"),
                currdata,
                function(data) {
                    self.setCurrentOpenPreset(data, 
                            self._dialog.find("#id_name").val(), currdata, false)
                    self._dialog.dialog("close");
                    if (self._continueaction)
                        self._continueaction();
                },
                OcrJs.ajaxErrorHandler
            );
        });

        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
            modal: true,
            position: pos,
            width: tb.width(),
            close: function(e, ui) {
                self._dialog.children().remove();
                self.trigger("saveDialogClose");    
            },
        });
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
            data: {data: JSON.stringify(script, null, 2)},
            type: "POST",
            error: errorfunc,
            success: successfunc,
        });                
    },

    saveCreatedPreset: function(name, tags, description, private, script, successfunc, errorfunc) {
        if (!script || $.map(script, function(k,v){ return k;}).length == 0)
            throw "Attempt to save new preset with no data! " + name;            
        $.ajax({
            url: "/presets/createjson/",
            type: "POST",
            data: {
                name: name,
                tags: tags,
                description: description,
                private: private,
                data: JSON.stringify(script, null, 2),
            },        
            error: errorfunc, 
            statusCode: {
                200: function(data) {
                    console.error("200", data);
                },
                201: successfunc,
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
