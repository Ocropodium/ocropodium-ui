// Try and coerce messy parameter-building logic into slightly less messy
// object.  The challenge here is to support multiple params of the same
// type, i.e. the binclean[0-10] params used by the pre-processing stage.


function ParameterBuilder(container_id, ctypes) {

    var url = "/ocr/components?" + $.map(ctypes, function(c, i) {
            return "type=" + c;
    }).join("&"),

    container = $("#" + container_id),

    // cache of parameter data, fetched from the server
    paramdata = null,

    // the list of components to build initially, set via
    // registerComponent
    components = [],

    // meta-component - component containing other components
    metacomponent = null,

    // track the number of multiple params of each type
    multiples = {},

    // regrettable need to map component names against
    // their respective component types.  TODO: Make this
    // go away
    namemap = {
        binclean:   "ICleanupBinary",
        grayclean:  "ICleanupGray",
        binarizer:  "IBinarize",
        graydeskew: "ICleanupBinary",   // don't ask...?
        bindeskew:  "ICleanupBinary",        
        psegmenter: "ISegmentPage",
    };

    /*
     *  Event handling
     */

    // rebuild the params when components change
    $(".ocroption").live("change", function(e) {
        setComponentParams($(this).val(), $(this).next());
    });


    /*
     *  Functions
     */

    // add a component to the list of initially-built ones
    this.registerComponent = function(cname, label, def, multiple, add_blank) {
        components.push({
            name: cname,
            label: label,
            defvalue: def,
            blank: add_blank || false,
            multiple: multiple || false,
        });
        if (multiple) {
            ++multiples[cname] || (multiples[cname] = 0);
        }
    }

    // allow registering a 'meta-parameter', aka StandardPreprocessing
    // that simply lists a collection of other params...
    this.registerDefaultMetaComponent = function(cname) {
        metacomponent = cname;        
    }

    // trigger the ajax call to fetch parameter info...
    this.init = function() {
        $.ajax({
            url: url,
            dataType: "json",
            error: function(xhr, error) {
                alert("Unable to fetch parameter info: " + error);
            },
            success: function(data) {
                paramdata = data;
                buildParameters();
            },
        });
    }

    // construct a UI containing the registered components, with
    // the fetched default parameter info...
    var buildParameters = function() {
        if (metacomponent) {
            buildMetaComponentSet();
        } else {
            buildRegisteredComponentSet();
        }
    }


    // use a particular component to provide a template
    // for the full component set
    var buildMetaComponentSet = function() {
        var metacomp = paramdata[metacomponent];

        // sort the list alphabetically - affects the
        // original data but we don't care
        metacomp.params.sort(function(a, b) {
            var x = a.name;
            var y = b.name;
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });

        // sort the list so multiple c-params go at the end...
        var splist = [];
        var mplist = [];
        $.each(metacomp.params, function(i, param) {
            if (param.name.match(/(\d+)$/)) {
                mplist.push(param);
            } else {
                splist.push(param);
            }
        });
        // add both lists of params to the page
        $.each([splist, mplist], function(i, list) {
            $.each(list, function(i, param) {
                if (param.value) {
                    addComponentSelect(param.name, param.name, param.value, true);
                }
            });
        });
    }

    var buildRegisteredComponentSet = function() {
        for (var i in components) {
            var comp = components[i];
            addComponentSelect(comp.name, comp.label, comp.defvalue, comp.blank);
        }
    }

    // get the component type for a string name like
    // binclean0 -> ICleanupBinary.  This is listed
    // in the namemap but we also need to strip of
    // any numeric suffix
    var getComponentType = function(compname) {
        var ctype = namemap[compname.match(/(\w+?)(\d*)$/)[1]];
        if (!ctype) {
            throw "Bad component type string: '" + compname + 
                "'.  Expecting something like 'binclean0', 'binarizer'";
        }
        return ctype; 
    }

    var setComponentParams = function(compname, pdiv) {
        pdiv.html("");
        if (!compname || compname == "-") {
            return;
        }
        var plabel = $("<label></label>");
        var pinput = $("<input type='text'></input>");
        for (var i in paramdata[compname].params) {
            var param = paramdata[compname].params[i];
            var pname = compname + "__" + param.name;
            pdiv.append(plabel.clone().text(param.name).attr("for", pname));    
            pdiv.append(
                pinput.clone()
                    .attr("name", pname).attr("id", pname)
                    .val(param.value));
        }    
    }

    var addComponentSelect = function(name, label, def, blank) {
        var lab = $("<label></label>")
            .attr("for", name)
            .text(label);
        var sel = $("<select></select>")
            .addClass("ocroption")
            .attr("id", name)
            .attr("name", name);
        var pdiv = $("<div></div>")
            .addClass("compparam")
            .attr("id", name + "_options");
        if (blank) {
            sel.append($("<option></option>").attr("value", "-"));
        }
        var comptype = getComponentType(name);
        for (var pname in paramdata) {
            var data = paramdata[pname];
            // skip metacomponent or those of different types
            if (data.type != comptype || 
                    (metacomponent && metacomponent == data.name)) {
                continue;
            }
            sel.append($("<option></option>")
                    .attr("value", data.name)
                    .text(data.name)); 
        }
        if (def) {
            sel.attr("value", def);
            setComponentParams(def, pdiv);
        }
        container.append(lab).append(sel).append(pdiv);
    }
}
