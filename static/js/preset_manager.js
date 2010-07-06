// Preset manager class.  A popup window which handles
// showing and selecting from a list of presets of a
// given type, i.e. "binarize", "segment"


function PresetManager(type) {

    var loadeddata = null;
    var currentpreset = null;
    
    // capture outer scope for callback functions...
    var me = this;

    // build popup window html
    var container = $("<div></div>")
        .attr("id", "preset_manager")
        .addClass("preset_container")
        .hide();
    var presetlist = $("<ul></ul>")
        .attr("id", "preset_list")
        .addClass("pm_preset_list");
    var presetdetails = $("<div></div>")
        .attr("id", "preset_details")
        .addClass("pm_preset_details");
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
        .attr("value", "Enter preset description");
    var savebutton = $("<input type='button'></input>")
        .attr("id", "save_button")
        .addClass("pm_preset_button")
        .attr("disabled", true)
        .attr("value", "Save Preset");

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
            }
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
            }
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
            }
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

        if (!(name && desc)) {
            alert("You must supply a name and description");
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
            }
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
        container.append(presetlist).append(presetdetails)
            .append(buttonbox.append(loadbutton).append(deletebutton));
        $(document).append(container);
        //container.position(target.position());
        container.dialog({title: "Load Preset...", close: me.hide});       
        loadData();           
    }

    this.hide = function() {
        $(".pm_preset_item, #delete_button, #load_button, #save_button").unbind();
        buttonbox.empty();
        container.empty().remove();
    }

    this.new = function(event) {
        var target = event ? $(event.target) : $(document);

        container.append(presetname).append(presetdesc)
            .append(buttonbox.append(savebutton));
        $(document).append(container);
        presetname.focus().select();

        $("#save_button").live("click", function(event) {
            savePreset();
        });        
        $("#preset_name, #preset_description").live("change", function(e) {
            if (presetname.val() && presetdesc.val()) {
                savebutton.attr("disabled", false);
            }
        });

        container.dialog({title: "Save Preset...", close: me.hide});
    }

    // add a preset select list to the given container...
    this.addControls = function(container_id) {
        var plabel = $("<label></label>")
            .attr("for", "preset_id")
            .text("Preset: ");
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
            .append(plabel)
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
            }
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
    });

    $(".pm_preset_select").live("change", function(event) {
        loadPresetData($(this).val());
    });

    $("#load_button").live("click", function() {
        loadPresetData(currentpreset.pk);
    });

    $("#delete_button").live("click", function() {
        deletePreset(currentpreset.pk);
    });

    $("#load_preset").live("click", function(e) {
            presetmanager.show(e);
            return false;
    });

    $("#save_preset").live("click", function(e) {
            presetmanager.new(e);
            return false;
    });

    $("#clear_preset").live("click", function(e) {
        $("#options").empty();
        buildComponentOptions();
        $("#preset_id").val(0);
        return false;
    });


}
