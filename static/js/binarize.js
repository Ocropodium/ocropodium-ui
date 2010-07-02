

var PARAMS = {}; // sorry, global.


// rebuild the params for a given component when it is
// selected
function reinitParams(binselect) {
    var compname = binselect.val();
    var paramlabel = $("<label></label>");
    var paraminput = $("<input type='text'></input>");
    var pdiv = binselect.next();
    if (pdiv.attr("tagName") == "DIV") {
        pdiv.html("");
        pdiv.remove();
    }
    // that'll do if we're just removing the component 
    if (compname == "") {
        return;
    }
    
    var params = PARAMS[compname].params;
    if (params.length) {
        pdiv = $("<div></div>").attr("class", "compparam");
        $.each(params, function(index, param) {
            var plabel = paramlabel.clone()
                .attr("foo", binselect.val() + "_option")
                .text(param.name);
            var pinput = paraminput.clone()
                .attr("name", binselect.val() + "__" + param.name)
                .attr("value", param.value);
            pdiv.append(plabel).append(pinput);
            binselect.after(pdiv);
        });
    }
}


function setSingleOptionDefaults(components) {
    $.each(components["StandardPreprocessing"].params, function(index, param) {
        if (param.name == "binarizer") {
            $("#binarizer").attr("name", param.name).val(param.value);
        } else if (param.name == "graydeskew") {
            $("#graydeskew").attr("name", param.name).val(param.value);
        } else if (param.name == "bindeskew") {
            $("#bindeskew").attr("name", param.name).val(param.value);
        }
    });
}

function setMultiOptionDefaults(components, bincleansel, graycleansel) { // FIXME: Stupid params!
    $.each(components["StandardPreprocessing"].params, function(index, param) {
        if (param.value) {
            var cselect;
            if (param.name.search("grayclean") != -1) {
                cselect = graycleansel.clone();
            } else if (param.name.search("binclean") != -1) {
                cselect = bincleansel.clone();
            }
            if (cselect) {
                cselect.attr("name", param.name)
                    .val(param.value).attr("id", param.name);
                $("#options").append("<label>" + param.name + "</label>")
                    .attr("for", param.name);
                $("#options").append(cselect);
            }
        }
    });
}


function setupOptions(components) {

    var option = $("<option></option>");
    // build selects for each component type
    var baseselect = $("<select></select>").addClass("ocroption");
    var binarizesel = baseselect.clone().attr("id", "binarizer");
    var bindeskewsel = baseselect.clone().attr("id", "bindeskew");
    var graydeskewsel = baseselect.clone().attr("id", "graydeskew");
    var bincleansel = baseselect.clone();
    var graycleansel = baseselect.clone();
        
    // add a blank option to some of them
    $.each([bincleansel, bindeskewsel, 
            graydeskewsel, graycleansel], function(index, item) {
        item.append(option.clone().attr("value", ""));
    });

    $.each(components, function(name, component) {
            var newopt = option.clone()
            .attr("value", component.name)
            .text(component.name);
        if (component.type == "IBinarize" 
                && component.name != "StandardPreprocessing") {
            binarizesel.append(newopt);
        } else if (component.type == "ICleanupBinary") {
            if (component.name == "DeskewGrayPageByRAST") {            
                graydeskewsel.append(newopt);
            } else if (component.name == "DeskewPageByRAST") {
                bindeskewsel.append(newopt);
                } else {
                //alert("Adding to binclean: " + component.name);
                bincleansel.append(newopt); 
            }
        } else if (component.type == "ICleanupGray") {
            graycleansel.append(newopt);
        }
    });

    $("#options").append("<label>Binarizer</label>").attr("for", "binarizer");
    $("#options").append(binarizesel);
    $("#options").append("<label>Deskew Grayscale</label>").attr("for", "graydeskew");
    $("#options").append(graydeskewsel);
    $("#options").append("<label>Deskew Binary</label>").attr("for", "bindeskew");
    $("#options").append(bindeskewsel);

    // set options and defaults on multi-value options (binclean, grayclean)
    setMultiOptionDefaults(components, bincleansel, graycleansel);

    // set the remaining defaults to those listed in StandardPreprocessing...
    setSingleOptionDefaults(components);        

    // add appropriate options for components
    layoutOptions(components);
}


function layoutOptions(components) {
    var paramdiv = $("<div></div>").addClass("compparam");
    var paramlabel = $("<label></label>");
    var paraminput = $("<input type='text'></input>");
    // lay out parameter...
    var sp = components["StandardPreprocessing"];
    $.each(sp.params, function(index, param) {
        var paramname = param.name;
        var cselect = $("select.ocroption#" + paramname);
        var compname = cselect.val();
        if (compname) {
            var component = components[compname];
            var compparams = component.params;
            var pdiv = paramdiv.clone().attr("id", cselect.attr("id") + "_options");
            $.each(compparams, function(index, param) {
                var paramname = compname + "__" + param.name;
                var plabel = paramlabel.clone()
                    .attr("for", paramname)
                    .text(param.name);
                var pinput = paraminput.clone()
                    .attr("name", paramname)
                    .attr("id", paramname)
                    .val(param.value);
                pdiv.append(plabel).append(pinput);
                cselect.after(pdiv);            
            });
        }
    });
}


function buildComponentOptions() {
    // get the component data for the types we want
    var types = ["IBinarize", "ICleanupBinary", "ICleanupGray"];
    // returns a list component hashes
    $.getJSON("/ocr/components", types.join("&"), function(components) {
        PARAMS = components;
        setupOptions(components);        
    });
}


var getCropRect = null;


$(function() {


});


