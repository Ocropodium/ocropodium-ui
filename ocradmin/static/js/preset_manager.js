// Preset manager class.  A popup window which handles
// showing and selecting from a list of presets of a
// given type, i.e. "binarize", "segment"

// Note: showing/editing preset description/tags is not
// yet implemented

var OCRJS = OCRJS || {};

OCRJS.PresetManager = OCRJS.OcrBase.extend({
    constructor: function(parent, type, options) {
        this.base(parent, options);
        this._type = type;
        this._loadeddata = null;
        this._currentpreset = null;
    
        this._container = $(parent);

        this._listeners = {
            onClearPreset: [],
            onPresetLoad: [],
            onPresetLoadData: [],
            onPresetSave: [],
            onPresetDelete: [],
            onBeforeAction: [],
            onCompleteAction: [],
            onPresetClear: [],        
        };

        // build popup window html
        this._dialogdiv = $("<div></div>")
            .attr("id", "preset_manager")
            .addClass("preset_this._dialogdiv")
            .hide();
        this._presetlist = $("<ul></ul>")
            .attr("id", "preset_list")
            .addClass("pm_preset_list");
        this._presetdetails = $("<div></div>")
            .attr("id", "preset_details")
            .addClass("pm_preset_details")
            .hide();
        this._buttonbox = $("<div></div>")
            .attr("id", "button_box")
            .addClass("pm_button_box");
        this._loadbutton = $("<input type='button'></input>")
            .attr("id", "load_button")
            .addClass("pm_preset_button")
            .attr("disabled", true)
            .attr("value", "Load Preset");
        this._deletebutton = $("<input type='button'></input>")
            .attr("id", "delete_button")
            .addClass("pm_preset_button")
            .attr("disabled", true)
            .attr("value", "Delete Preset");


        // save dialog controls
        this._presetname = $("<input type='text'></input")
            .attr("id", "preset_name")
            .attr("name", "preset_name")
            .addClass("pm_preset_input")
            .attr("value", "Enter preset name");
        this._presetdesc = $("<textarea></textarea>")
            .attr("id", "preset_description")
            .attr("name", "preset_description")
            .addClass("pm_preset_input")
            .attr("value", "");
        this._savebutton = $("<input type='button'></input>")
            .attr("id", "save_button")
            .addClass("pm_preset_button")
            .attr("disabled", true)
            .attr("value", "Save Preset");
        this.setupEvents();
        this.addControls();
    },


    setupEvents: function() {                 
        var self = this;                     
        // hook up events
        $(".pm_preset_item").live("click", function(event) {
            $(".pm_preset_item").removeClass("selected");
            $(this).addClass("selected");
            self.loadPresetDetails($(this).text());
        });

        $(".pm_preset_item").live("dblclick", function(event) {
            self.loadPresetDetails($(this).text());
            self.loadPresetData(self._currentpreset.pk);
            self.callListeners("onPresetLoad");
        });

        $(".pm_preset_select").live("change", function(event) {
            var pk = $(this).val();
            if (pk > 0) {
                self.loadPresetData(pk);
            } else {
                self.callListeners("onPresetClear");
            }        
        });

        $("#load_preset").live("click", function(event) {
            self.loadPresetData(self._currentpreset.pk);
            self.callListeners("onPresetLoad");
        });

        $("#delete_preset").live("click", function(event) {
            self.deletePreset(self._currentpreset.pk);
            self.callListeners("onPresetDelete");
        });

        $("#load_preset").live("click", function(event) {
            self.show(event);
            return false;
        });

        $("#save_preset").live("click", function(event) {
            self.save(event);
            self.callListeners("onPresetSave");
            return false;
        });

        $("#clear_preset").live("click", function(event) {
            $("#options").empty();
            self.callListeners("onPresetClear");
            $("#preset_id").val(0);
            return false;
        });

        $("#save_button").live("click", function(event) {
            self.savePreset();
        });        
        $("#preset_name, #preset_description").live("keyup", function(e) {
            if (self._presetname.val()) {
                self._savebutton.attr("disabled", false);
            }
        });
    },



                
    // overrideable events
    getPresetData: function() {

    },    


    // ajax callbacks
    beforeSend: function(event) {
        this._container.addClass("waiting");
        this.callListeners("onBeforeAction");
    },

    onComplete: function(event) {
        this._container.removeClass("waiting");
        this.callListeners("onCompleteAction");
    },


    reloadData: function() {
        this._presetlist.html("");
        var self = this;
        $.each(this._loadeddata, function(index, preset) {
            var pitem = $("<li></li>")
                .attr("id", "preset" + index)
                .addClass("pm_preset_item")
                .addClass(index % 2 ? "even" : "odd")
                .text(preset.fields.name);
            self._presetlist.append(pitem);
        });
    },

    
    loadData: function() {
        var self = this;                  
        $.ajax({
            url: "/ocrpresets/list",
            dataType: "json",
            data: {type: self._type},
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                self._loadeddata = data;
                self.reloadData();
            },
            beforeSend: function(xhr) { self.beforeSend(xhr) },
            complete: function(xhr) { self.onComplete(xhr) },
        });
    },

    deletePreset: function(preset_pk) {
        var self = this;                      
        if (preset_pk == null) {
            alert("No preset selected!");
            return;
        }
        
        $("#load_button, delete_button").attr("disabled", true);
        $.ajax({
            url: "/ocrpresets/delete/" + preset_pk + "/",
            success: function(data) {
                self._loadeddata = data;
                self.reloadData();
                self.rebuildPresetList(data);                
            },
            beforeSend: function(xhr) { self.beforeSend(xhr) },
            complete: function(xhr) { self.onComplete(xhr) },
            error: OCRJS.ajaxErrorHandler,
        });
    },

    loadPresetData: function(preset_pk) {
        var self = this;                        
        if (preset_pk == null) {
            alert("No preset selected!");
            return;
        }
        
        $("#load_button, delete_button").attr("disabled", true);
        $.ajax({
            url: "/ocrpresets/data/" + preset_pk + "/",
            success: function(presetdata) {
                self.callListeners("onPresetLoadData", presetdata);
                self.hide();
                $("#preset_id").val(preset_pk);
            },
            beforeSend: function(xhr) { self.beforeSend(xhr) },
            complete: function(xhr) { self.onComplete(xhr) },
            error: OCRJS.ajaxErrorHandler,
        });        
    },


    loadPresetDetails: function(name) {
        if (this._loadeddata == null) {
            alert("No presets loaded!");
            return;
        }
        var preset = null;
        $.each(this._loadeddata, function(index, pitem) {
            if (pitem.fields.name == name) {
                preset = pitem;
            }
        });
        if (preset == null) {
            alert("Preset: " + name + " not found!");
            return;
        }
        this._presetdetails.text(preset.fields.description);
        this._currentpreset = preset;
        this._deletebutton.attr("disabled", false);
        this._loadbutton.attr("disabled", false);
    },

    savePreset: function() {
        var self = this;
        var name = $("#preset_name").val();
        var desc = $("#preset_description").val();

        if (!(name)) {
            alert("You must supply a preset name");
            return false;
        }
        $("#save_button").attr("disabled", true);
        var formdata = {
            "name": name, 
            "description": desc,
            "type": self._type,
            "data": self.getPresetData(),
        };

        $.ajax({
            url: "/ocrpresets/create",
            dataType: "json",
            data: formdata,
            type: "POST",
            success: function(data) {
                // add a new option to the preset list
                var poption = $("<option></option>")
                    .attr("value", data[0].pk)
                    .text(data[0].fields.name);
                $("#preset_id").append(poption).val(data[0].pk);
                self.hide();
            },
            error: OCRJS.ajaxErrorHandler,
            beforeSend: function(xhr) { self.beforeSend(xhr) },
            complete: function(xhr) { self.onComplete(xhr) },
        });            
    },

    rebuildPresetList: function(data) {
        var pselect = $("#preset_id");
        pselect.empty();
        var blank = $("<option></option>")
            .attr("value", 0)
            .text("---");
        pselect.append(blank);
        $.each(data, function(index, preset) {
            var poption = blank.clone()
                .attr("value", preset.pk)
                .text(preset.fields.name);
            pselect.append(poption);
        });
        pselect.attr("disabled", false);    
    },


    show: function(event) {
        var self = this;
        var target = event ? $(event.target) : $(document);
        // add the html to the dom and position it
        // on the target
        this._dialogdiv.append(this._presetlist).append(this._presetdetails)
            .append(this._buttonbox.append(this._loadbutton).append(this._deletebutton));
        $(document).append(this._dialogdiv);
        //this._dialogdiv.position(target.position());
        this._dialogdiv.dialog({
            title: "Manage Presets",
            modal: true,
            close: function(ev) { self.hide(ev) },
            dialogClass: "manage_dialog",
        });       
        this.loadData();           
    },

    hide: function() {
        $(".pm_preset_item, #delete_button, #load_button, #save_button").unbind();
        this._buttonbox.empty();
        this._dialogdiv.slideUp(200).empty().remove();
    },

    save: function(event) {
        var self = this;
        var target = event ? $(event.target) : $(document);
        //container.addClass("waiting")
        this._dialogdiv
            .append(this._presetname)
            .append(this._savebutton);

        // place the control at the bottom of the param div
        // and scroll it down
        this._dialogdiv.dialog({
            dialogClass: "save_dialog",
            position: [
                self._container.position().left,
                self._container.position().top - $(document).scrollTop() + self._container.height(),
            ],
            minHeight: "10",
            modal: true,
            draggable: false,
            resizable: false,
        });
        this._presetname.select();
    },

    // add a preset select list to the given dialogdiv...
    addControls: function() {
        var self = this;
        var pselect = $("<select></select>")
            .addClass("pm_preset_select")
            .attr("name", "preset_id")
            .attr("id", "preset_id")
            .attr("disabled", true);
        var savelink = $("<a>Save</a>")
            .attr("href", "#")
            .attr("id", "save_preset")
            .addClass("preset_control");
        var managelink = $("<a>Manage</a>")
            .attr("href", "#")
            .attr("id", "load_preset")
            .addClass("preset_control");
        var clearlink = $("<a>Clear</a>")
            .attr("href", "#")
            .attr("id", "clear_preset")
            .addClass("preset_control");
        this._container
            .append(pselect)
            .append(savelink)
            .append(managelink)
            .append(clearlink);
        $.ajax({
            url: "/ocrpresets/list/",
            dataType: "json",
            data: { type: self._type },
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                self.rebuildPresetList(data);
            },
            beforeSend: function(xhr) { self.beforeSend(xhr) },
            complete: function(xhr) { self.onComplete(xhr) },
        });                   
    },

});
