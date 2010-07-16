
var PARAMS = null; // sorry, global.

function buildComponentOptions() {
    // get the component data for the types we want
    // returns a list component hashes
    //
    

    if (PARAMS == null) {
        $.getJSON("/ocr/components", "type=ISegmentPage", function(components) {
            PARAMS = components;
            setupOptions(components);        
        });
    } else {
        setupOptions(PARAMS);
    }
}


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
            var paramname = binselect.val() + "__" + param.name;
            var plabel = paramlabel.clone()
                .attr("foo", binselect.val() + "_option")
                .text(param.name);
            var pinput = paraminput.clone()
                .attr("id", paramname)
                .attr("name", paramname)
                .attr("value", param.value);
            pdiv.append(plabel).append(pinput);
            binselect.after(pdiv);
        });
    }
}


function setupOptions(components) {

    var option = $("<option></option>");
    // build selects for each component type
    var segselect = $("<select></select>")
        .addClass("ocroption")
        .attr("id", "psegmenter");
        
    $.each(components, function(name, component) {
            var newopt = option.clone()
            .attr("value", component.name)
            .text(component.name);
        segselect.append(newopt);
    });
    $("#options").empty();
    $("#options").append("<label>Segmenter</label>").attr("for", "psegmenter");
    $("#options").append(segselect);

    // set default option
    segselect.attr("name", "psegmenter").val("SegmentPageByRAST");
    
    // add appropriate options for components
    layoutOptions(components);
}


function layoutOptions(components) {
    var paramdiv = $("<div></div>").addClass("compparam");
    var paramlabel = $("<label></label>");
    var paraminput = $("<input type='text'></input>");
    // lay out parameter...
    //
    var cselect = $("#psegmenter");
    reinitParams(cselect);
/*    var compname = cselect.val();
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
    }*/
}






$(function() {
    

});



