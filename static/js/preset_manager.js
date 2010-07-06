// Preset manager class.  A popup window which handles
// showing and selecting from a list of presets of a
// given type, i.e. "binarize", "segment"

// Note: showing/editing preset description/tags is not
// yet implemented

function PresetManager(container_id, type) {

    var loadeddata = null;
    var currentpreset = null;
    
    var container = $("#" + container_id);

    // capture outer scope for callback functions...
    var me = this;

    // build popup window html
    var dialogdiv = $("<div></div>")
        .attr("id", "preset_manager")
        .addClass("preset_dialogdiv")
        .hide();
    var presetlist = $("<ul></ul>")
        .attr("id", "preset_list")
        .addClass("pm_preset_list");
    var presetdetails = $("<div></div>")
        .attr("id", "preset_details")
        .addClass("pm_preset_details")
        .hide();
    var buttonbox = $("<div></div>")
        .attr("id", "button_box")
        .addClass("pm_button_box");
    var loadbutton = $("<input type='button'></input>")
        .attr("id", "load_button")
        .addClass("pm_preset_button")
        .attr("disabled", true)
        .attr("value", "Load Preset");
    var deletebutton = $("<input type='button'></input>")
        .attr("id", "delete_button")
        .addClass("pm_preset_button")
        .attr("disabled", true)
        .attr("value", "Delete Preset");


    // save dialog controls
    var presetname = $("<input type='text'></input")
        .attr("id", "preset_name")
        .attr("name", "preset_name")
        .addClass("pm_preset_input")
        .attr("value", "Enter preset name");
    var presetdesc = $("<textarea></textarea>")
        .attr("id", "preset_description")
        .attr("name", "preset_description")
        .addClass("pm_preset_input")
        .attr("value", "");
    var savebutton = $("<input type='button'></input>")
        .attr("id", "save_button")
        .addClass("pm_preset_button")
        .attr("disabled", true)
        .attr("value", "Save Preset");

    // overrideable events
    this.onClearPreset = function(event) {
    }

    this.onPresetLoad = function(event) {
    }

    this.onPresetSave = function(event) {
    }

    this.onPresetDelete = function(event) {
    }

    this.onBeforeAction = function(event) {
    }

    this.onCompleteAction = function(event) {
    }


    // alias 'this' to capture inner scope
    var me = this;

    // ajax callbacks
    var beforeSend = function(event) {
        container.addClass("waiting");
        me.onBeforeAction(event);

    }

    var onComplete = function(event) {
        container.removeClass("waiting");
        me.onCompleteAction(event);
    }


    var reloadData = function() {
        presetlist.html("");
        $.each(loadeddata, function(index, preset) {
            var pitem = $("<li></li>")
                .attr("id", "preset" + index)
                .addClass("pm_preset_item")
                .addClass(index % 2 ? "even" : "odd")
                .text(preset.fields.name);
            presetlist.append(pitem);
        });
    }

    
    var loadData = function() {
        $.ajax({
            url: "/ocrpresets/list",
            dataType: "json",
            data: {type: type},
            success: function(data) {
                loadeddata = data;
                reloadData();
            },
            beforeSend: beforeSend,
            complete: onComplete,
        });
    }

    var deletePreset = function(preset_pk) {
        if (preset_pk == null) {
            alert("No preset selected!");
            return;
        }
        
        $("#load_button, delete_button").attr("disabled", true);
        $.ajax({
            url: "/ocrpresets/delete/" + preset_pk + "/",
            success: function(data) {
                loadeddata = data;
                reloadData();
                rebuildPresetList(data);                
            },
            beforeSend: beforeSend,
            complete: onComplete,
        });
    }

    var loadPresetData = function(preset_pk) {
        if (preset_pk == null) {
            alert("No preset selected!");
            return;
        }
        
        $("#load_button, delete_button").attr("disabled", true);
        $.ajax({
            url: "/ocrpresets/data/" + preset_pk + "/",
            success: function(presetdata) {
                $(".ocroption").each(function(index, item) {
                    var cname = $(this).attr("name");
                    if (presetdata[cname]) {
                        $(this).val(presetdata[cname]);
                        $(item).trigger("change");
                    }
                });
                $(".compparam > input").each(function(index, item) {
                    var pname = $(this).attr("name");
                    if (presetdata[pname]) {
                        $(this).val(presetdata[pname]);
                    }
                });
                me.hide();
                $("#preset_id").val(preset_pk);
            },
            beforeSend: beforeSend,
            complete: onComplete,
        });        
    }


    var loadPresetDetails = function(name) {
        if (loadeddata == null) {
            alert("No presets loaded!");
            return;
        }
        var preset = null;
        $.each(loadeddata, function(index, pitem) {
            if (pitem.fields.name == name) {
                preset = pitem;
            }
        });
        if (preset == null) {
            alert("Preset: " + name + " not found!");
            return;
        }
        presetdetails.text(preset.fields.description);
        currentpreset = preset;
        deletebutton.attr("disabled", false);
        loadbutton.attr("disabled", false);
    }

    var savePreset = function() {
        var name = $("#preset_name").val();
        var desc = $("#preset_description").val();

        if (!(name)) {
            alert("You must supply a preset name");
            return false;
        }
        $("#save_button").attr("disabled", true);
        var formdata = {
            "preset_name": name, 
            "preset_description": desc,
            "preset_type": type,
        };
        // slurp all the form data
        $(".ocroption, .compparam > input").each(function(index, item) {
            formdata["ocrdata_" + $(item).attr("name")] = $(item).val();
        });

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
                me.hide();
            },
            error: function(xhr, errtype, exception) {
                alert("Error saving preset: " + errtype);
            },
            beforeSend: beforeSend,
            complete: onComplete,
        });            
    }

    var rebuildPresetList = function(data) {
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
    }


    this.show = function(event) {
        var target = event ? $(event.target) : $(document);
        // add the html to the dom and position it
        // on the target
        dialogdiv.append(presetlist).append(presetdetails)
            .append(buttonbox.append(loadbutton).append(deletebutton));
        $(document).append(dialogdiv);
        //dialogdiv.position(target.position());
        dialogdiv.dialog({
            title: "Manage Presets",
            modal: true,
            close: me.hide,
            dialogClass: "manage_dialog",
        });       
        loadData();           
    }

    this.hide = function() {
        $(".pm_preset_item, #delete_button, #load_button, #save_button").unbind();
        buttonbox.empty();
        dialogdiv.slideUp(200).empty().remove();
    }

    this.save = function(event) {
        var target = event ? $(event.target) : $(document);
        //container.addClass("waiting")
        dialogdiv
            .append(presetname)
            .append(savebutton);

        // place the control at the bottom of the param div
        // and scroll it down
        dialogdiv.dialog({
            dialogClass: "save_dialog",
            position: [
                container.position().left,
                container.position().top - $(document).scrollTop() + container.height(),
            ],
            minHeight: "10",
            modal: true,
            draggable: false,
            resizable: false,
        });
        presetname.select();
    }

    // add a preset select list to the given dialogdiv...
    var addControls = function() {
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
        $("#" + container_id)
            .append(pselect)
            .append(savelink)
            .append(managelink)
            .append(clearlink);
        $.ajax({
            url: "/ocrpresets/list/",
            dataType: "json",
            data: { type: type },
            success: function(data) {
                rebuildPresetList(data);
            },
            beforeSend: beforeSend,
            complete: onComplete,
        });                   
    }

    // hook up events
    $(".pm_preset_item").live("click", function(event) {
        $(".pm_preset_item").removeClass("selected");
        $(this).addClass("selected");
        loadPresetDetails($(this).text());
    });

    $(".pm_preset_item").live("dblclick", function(event) {
        loadPresetDetails($(this).text());
        loadPresetData(currentpreset.pk);
        me.onPresetLoad(event);
    });

    $(".pm_preset_select").live("change", function(event) {
        var pk = $(this).val();
        if (pk > 0) {
            loadPresetData(pk);
        } else {
            me.onPresetClear(event);
        }        
    });

    $("#load_button").live("click", function(event) {
        loadPresetData(currentpreset.pk);
        me.onPresetLoad(event);
    });

    $("#delete_button").live("click", function(event) {
        deletePreset(currentpreset.pk);
        me.onPresetDelete(event);
    });

    $("#load_preset").live("click", function(event) {
            presetmanager.show(event);
            return false;
    });

    $("#save_preset").live("click", function(event) {
            presetmanager.save(event);
            me.onPresetSave(event)
            return false;
    });

    $("#clear_preset").live("click", function(event) {
        $("#options").empty();
        me.onPresetClear(event);
        $("#preset_id").val(0);
        return false;
    });

    $("#save_button").live("click", function(event) {
        savePreset();
    });        
    $("#preset_name, #preset_description").live("keyup", function(e) {
        if (presetname.val()) {
            savebutton.attr("disabled", false);
        }
    });

    // add controls to the container div
    addControls();

}
