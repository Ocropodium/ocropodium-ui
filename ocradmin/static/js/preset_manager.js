//
// Preset manager class.  Holds a reference to the current
// preset and manages saving, updating, or clearing it.
//

var OCRJS = OCRJS || {};

OCRJS.PresetManager = OCRJS.OcrBase.extend({
    constructor: function(parent, nodetree, options) {
        this.base(parent, options);
        this.parent = parent;

        this._nodetree = nodetree;

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
        };

        this._opened = null;
        this._openedhash = null;
        this._current = null;

        // flag telling us we should continue to
        // offer the open dialog after the current
        // save dialog
        this._continueaction = null;

        this.setupEvents();
    },

    saveState: function() {
        var presetdata = {
            opened: this._opened,
            openedhash: this._openedhash,
            name: $("#current_preset_name").text(),
        };
        if (this.hasChanged()) {
            presetdata.script = this._nodetree.buildScript();
        }
        $.cookie("presetdata", JSON.stringify(presetdata));
    },

    loadState: function() {
        var self = this;                   

        // check if we need to load a task's data                   
        var taskpk = $("#edit_task_pk").val();
        if (taskpk) {
            $.ajax({
                url: "/ocr/task_config/" + taskpk,
                dataType: "JSON",                
                error: OCRJS.ajaxErrorHandler,
                success: function(data) {
                    console.log("OPENING TASK SCRIPT:", data);                    
                    self.setCurrentOpenPreset(
                        "edittask" + taskpk, 
                        $("#edit_task_batch").val() + ": " + $("#edit_task_page").val(),
                        data, true);
                },                
            });

        } else {

            var cookie = $.cookie("presetdata");
            if (!cookie)
                return;
            var presetdata = JSON.parse(cookie);
            if (presetdata.opened && !presetdata.script) {
                this.openPreset(presetdata.opened, function(data) {
                    self.setCurrentOpenPreset(presetdata.opened, presetdata.name, data, true);
                    self._openedhash = presetdata.openedhash;
                    self._dialog.dialog("close");
                }, OCRJS.ajaxErrorHandler);
            } else if (presetdata.opened && presetdata.script) {
                self.setCurrentOpenPreset(presetdata.opened, presetdata.name, presetdata.script, true);
                $("#preset_unsaved").toggle(true);                         
            } else {

            }
        }            
    },                   

    setupEvents: function() {
        var self = this;

        $("#new_script, #new_script_button").click(function(event) {
            self.newPreset();
        });        
        
        $("#save_script, #save_script_button").click(function(event) {
            if (self._opened) {
                var name = $("#current_preset_name").text();
                self.saveExistingPreset(self._opened,
                    self._nodetree.buildScript(), function(data) {
                        self.setCurrentOpenPreset(self._opened, name, data, false);
                    });
            } else {
                self.showNewPresetDialog();
            }
        });        
        
        $("#save_script_as").click(function(event) {
            self.showNewPresetDialog();
        });        
        
        $("#open_script").click(function(event) {
            self.showOpenPresetDialog();
        });        
        
        $("#download_script").click(function(event) {
            var json = JSON.stringify(self._nodetree.buildScript(), null, 2);
            $("#fetch_script_slug").val(self._opened ? self._opened : "untitled");
            $("#fetch_script_data").val(json);
            $("#fetch_script").submit();
        });
    },

    newPreset: function() {
        if (this.hasChanged()) {
            this._continueaction = this.newPreset;
            if (this._opened)
                this.showSavePresetDialog();
            else
                this.showNewPresetDialog();
            return;
        }

        this._nodetree.clearScript();
        this._opened = this._openedhash = null;
        this._continueaction = null;
        $("#current_preset_name").text("Untitled");
        $("#preset_unsaved").toggle(false);                         
    },                   

    checkForChanges: function() {
        var changed = this.hasChanged();                         
        console.log("CHANGED: ", changed);
        $("#preset_unsaved").toggle(changed);                         
    },                         

    hasChanged: function() {
        // if we don't have a current hash and the nodetree
        // is empty, we don't need to bother doing anything                         
        if (!this._nodetree.hasNodes() && !this._openedhash)
            return false;
        // if we've got nodes and no current hash, we definitely
        // have something worth saving
        else if (this._nodetree.hasNodes() && !this._openedhash)
            return true;
        // otherwise compare the new hash and the current one
        // if they're different we need to save
        var hash = bencode(this._nodetree.buildScript());
        return hash != this._openedhash;
    },                         

    setCurrentOpenPreset: function(slug, name, data, reload) {
        console.log("Setting current:", this._nodetree._nodedata);
        console.log("Set current open script", slug, name, data);                              
        this._opened = slug;                              
        this._openedhash = bencode(data);
        if (reload) {        
            this._nodetree.clearScript();
            this._nodetree.loadScript(data);
            this._nodetree.scriptChanged("Loaded script");
        }
        $("#current_preset_name").text(name);
    },                              

    showOpenPresetDialog: function() {
        var self = this;

        if (this.hasChanged()) {
            this._continueaction = this.showOpenPresetDialog;
            if (this._opened)
                this.showSavePresetDialog();
            else
                this.showNewPresetDialog();
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
            self.openPreset(slug, function(data) {
                self.setCurrentOpenPreset(slug, item.text(), data, true);
                self._dialog.dialog("close");
                self._continueaction = null;
            }, OCRJS.ajaxErrorHandler);
            event.preventDefault();
            event.stopPropagation();
        });
    },

    showSavePresetDialog: function() {
        var self = this;        
        var tb = $(this.parent);        
        var pos = [tb.offset().left, tb.offset().top + tb.height()];
        this._dialog.html($.tmpl(this._updatetmpl, {}));

        this._dialog.find("#submit_save_script").click(function(event) {
            var data = self._nodetree.buildScript();
            var name = $("#current_preset_name").text();
            self.saveExistingPreset(self._opened, data, function(data) {
                self.setCurrentOpenPreset(self._opened, name, data, false);
                self._dialog.dialog("close");
                $("#preset_unsaved").toggle(false);   
                if (self._continueaction)
                    self._continueaction()
            }, OCRJS.ajaxErrorHandler);
        });
        this._dialog.find("#submit_save_script_as").click(function(event) {
            self.showNewPresetDialog();
        });
        this._dialog.find("#submit_close_without_saving").click(function(event) {
            console.log("Abandoned changes!");
            self._opened = self._openedhash = null;
            self._nodetree.clearScript();            
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
                self.callListeners("saveDialogClose");    
            },
        });
    },

    showNewPresetDialog: function() {
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
            var currdata = self._nodetree.buildScript();
            self.saveNewPreset(
                self._dialog.find("#id_name").val(),
                self._dialog.find("#id_tags").val(),
                self._dialog.find("#id_description").val(),
                self._dialog.find("#id_public").prop("checked"),
                currdata,
                function(data) {
                    self.setCurrentOpenPreset(data, 
                            self._dialog.find("#id_name").val(), currdata, false)
                    self._dialog.dialog("close");
                    $("#preset_unsaved").toggle(false);                         
                    if (self._continueaction)
                        self._continueaction();
                },
                OCRJS.ajaxErrorHandler
            );
        });

        this._dialog.dialog({
            dialogClass: "preset_manager_dialog",
            modal: true,
            position: pos,
            width: tb.width(),
            close: function(e, ui) {
                self._dialog.children().remove();
                self.callListeners("saveDialogClose");    
            },
        });
        this.callListeners("saveDialogOpen");
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

    saveNewPreset: function(name, tags, description, private, script, successfunc, errorfunc) {
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
