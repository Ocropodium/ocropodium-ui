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
            openScript: [],
        };

        this._opened = null;
        this._openedhash = null;
        this._current = null;

        // flag telling us we should continue to
        // offer the open dialog after the current
        // save dialog
        this._continuewithopen = false;

        this.setupEvents();
    },

    setupEvents: function() {
        var self = this;

        $("#save_script").click(function(event) {
            presetmanager.showNewPresetDialog();
            event.stopPropagation();
            event.preventDefault();    
        });        
        
        $("#open_script").click(function(event) {
            presetmanager.showOpenPresetDialog();
            event.stopPropagation();
            event.preventDefault();    
        });        
        
        $("#download_script").click(function(event) {
            var json = JSON.stringify(self._nodetree.buildScript(), false, '\t');
            $("#fetch_script_data").val(json);
            $("#fetch_script").submit();
            event.stopPropagation();
            event.preventDefault();    
        });
    },

    checkForChanges: function() {
        var elem = $("#open_script").find(".ui-button-text");
        if (this.hasChanged()) {
            if (!$(elem).text().match(/\*$/)) {
                $(elem).text($(elem).text() + "*");
            }
        } else {
            $(elem).text($(elem).text().replace(/\*$/, ""));
        }            
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

    setCurrentScript: function(script) {
        console.log("Set current script");                          
        this._current = script;
    },

    setCurrentOpenScript: function(slug, name, data, reload) {
        console.log("Set current open script", slug, name, data);                              
        this._opened = slug;                              
        console.log("Data: ", data);
        this._openedhash = bencode(data);
        if (reload) {        
            this._nodetree.clearScript();
            this._nodetree.loadScript(data);
            this._nodetree.scriptChanged("Loaded script");
        }
        $("#open_script").find(".ui-button-text").text(name);
    },                              

    showOpenPresetDialog: function() {
        var self = this;

        if (this.hasChanged()) {
            this._continuewithopen = true;
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
                self.setCurrentOpenScript(slug, item.text(), data, true);
                self._dialog.dialog("close");
                self._continuewithopen = false;
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

        console.assert(this._opened);
        this._dialog.find("#save_script").click(function(event) {
            var data = self._nodetree.buildScript();
            var name = $("#open_script").find(".ui-button-text").text().replace(/\*$/, "");
            self.saveExistingPreset(self._opened, data, function(data) {
                self.setCurrentOpenScript(self._opened, name, data, false);
                console.log("Saved current preset, opening: ", self._continuewithopen);
                self._dialog.dialog("close");
                if (self._continuewithopen)
                    self.showOpenPresetDialog();
            }, OCRJS.ajaxErrorHandler);
        });
        this._dialog.find("#save_script_as").click(function(event) {
            self.showNewPresetDialog();
        });
        this._dialog.find("#close_without_saving").click(function(event) {
            console.log("Abandoned changes!");
            self._opened = self._openedhash = null;
            self._nodetree.clearScript();            
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
        this._dialog.find("input[type='text']").keyup(function(event) {
            self.validateNewForm();
        });
        this._dialog.find("#create_new").click(function(event) {
            event.preventDefault();
            event.stopPropagation();
            self.saveNewPreset(
                self._dialog.find("#id_name").val(),
                self._dialog.find("#id_tags").val(),
                self._dialog.find("#id_description").val(),
                self._dialog.find("#id_public").prop("checked"),
                self._nodetree.buildScript(),
                function(data) {
                    self.setCurrentOpenScript(data, 
                            self._dialog.find("#id_name").val(), data, false)
                    self._dialog.dialog("close");
                    if (self._continuewithopen)
                        self.showOpenPresetDialog();
                },
                OCRJS.ajaxErrorHandler
            );
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

    saveExistingPreset: function(slug, script, successfunc, errorfunc) {
        if (!script || $.map(script, function(k,v){ return k;}).length == 0)
            throw "Attempt to save existing preset with no data! " + slug;            
        $.ajax({
            url: "/presets/update_data/" + slug,
            data: {data: JSON.stringify(script, null, '\t')},
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
                data: JSON.stringify(script, null, '\t'),
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
