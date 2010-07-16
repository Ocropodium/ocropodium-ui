// Try and coerce messy parameter-building logic into slightly less messy
// object.  The challenge here is to support multiple params of the same
// type, i.e. the binclean[0-10] params used by the pre-processing stage.


function ParameterBuilder(container_id, ctypes) {

    var url = "/ocr/components?" + $.map(ctypes, function(c, i) {
            return "type=" + c;
    }).join("&");

    var container = $("#" + container_id);

    // cache of parameter data, fetched from the server
    var paramdata = null;

    // the list of components to build initially, set via
    // registerComponent
    var components = [];

    // meta-component - component containing other components
    var metacomponent = null;

    // track the number of multiple params of each type
    var multiples = {};

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
    this.registerDefaultMetaparam = function(cname) {
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
            buildMetacomponentSet();
        } else {
            buildRegisteredComponentSet();
        }
    }


    var buildRegisteredComponentSet = function() {
        for (var i in components) {
            var comp = components[i];
            var label = $("<label></label>")
                .attr("for", comp.name)
                .text(comp.label);
            var sel = $("<select></select>")
                .addClass("ocroption")
                .attr("id", components[i].name);
            if (comp.blank) {
                sel.append($("<option></option>").attr("value", "-"));
            }
            container.append(label);
            container.append(sel);
        }
    }
}
