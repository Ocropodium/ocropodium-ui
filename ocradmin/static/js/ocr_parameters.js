// Try and coerce messy parameter-building logic into slightly less messy
// object.  The challenge here is to support multiple params of the same
// type, i.e. the binclean[0-10] params used by the pre-processing stage.
// FIXME: This is basically write-only ATM.


var OCRJS = OCRJS || {};


var ParameterBuilder = OCRJS.OcrBase.extend({
    constructor: function(parent, ctypes, options) {
        this.base(parent, options);
        this._url = "/ocr/components?" + $.map(ctypes, function(c, i) {
                return "type=" + c;
        }).join("&"),

        this._container = $(parent);

        // cache of parameter data, fetched from the server
        this._componentdata = null,

        // the list of components to build initially, set via
        // registerComponent
        this._components = [],

        // meta-component - component containing other components
        this._metacomponent = null,

        // track the number of multiple params of each type
        this._multiples = {},

        // regrettable need to map component names against
        // their respective component types.  TODO: Make this
        // go away
        this._namemap = {
            binclean:   "ICleanupBinary",
            grayclean:  "ICleanupGray",
            binarizer:  "IBinarize",
            bindeskew:  "ICleanupBinary",        
            graydeskew: "ICleanupGray",  
            psegmenter: "ISegmentPage",
            segmenter:  "ISegmentLine",
            grouper:    "IGrouper",
        };
        
        this.setupEvents();
    },



    setupEvents: function() {
        var self = this;

        // rebuild the params when components change
        $(".ocroption").live("change", function(e) {
            self.setComponentParams($(this).val(), $(this).parent("div").nextAll("div.compparam"));
        });

        $(".compsel").live('mouseenter mouseleave', function(event) {
            if (event.type == 'mouseover') {
                $(this).children("input[type='button']").css("opacity", 1);
            } else {
                $(this).children("input[type='button']").css("opacity", 0);
            }
        });

        $(".addmulti").live("click", function(e) {
            var compname = $(this).prev("select").attr("name");
            var thisdiv = $(this).parent("div").parent("div");
            var newdiv = thisdiv.clone();
            newdiv.children("select").val("-");
            newdiv.children("div.compparam").html("");
            thisdiv.after(newdiv);
            self.renumberMultiComponents(compname);
        });

        $(".remmulti").live("click", function(e) {
            var compname = $(this).prevAll("select").attr("name");
            $(this).parent("div").parent("div").remove();
            self.renumberMultiComponents(compname);
        });
    },



    // indicate we're doing something
    setWaiting: function(wait) {
        wait = wait || false;
        $(".ocroption, .compparam > input").attr("disabled", wait);
        //container.toggleClass("waiting", wait);
    },

    // return a hash of param data
    data: function() {
        var params = {};
        $(".ocroption, .compparam > input").each(function(i, p) {
            params[$(p).attr("name")] = $(p).val();
        });
        return params;    
    },

    serializedData: function() {
        var params = [];
        var data = this.data();
        for (var i in data) {
            params.push(i + "=" + data[i]);
        }
        return params.join("&");
    },

    // add a component to the list of initially-built ones
    registerComponent: function(cname, label, def, multiple, add_blank) {
        this._components.push({
            name: cname,
            label: label,
            defvalue: def,
            blank: add_blank || false,
            multiple: multiple || false,
        });
        if (multiple) {
            ++this.multiples[cname] || (this.multiples[cname] = 0);
        }
    },

    // allow registering a 'meta-parameter', aka StandardPreprocessing
    // that simply lists a collection of other params...
    registerDefaultMetaComponent: function(cname) {
        this._metacomponent = cname;        
    },

    // trigger the ajax call to fetch parameter info...
    init: function() {
        var self = this;              
        $.ajax({
            url: self._url,
            dataType: "json",
            beforeSend: function() {
                self.setWaiting(true);
            },
            complete: function() {
                self.setWaiting(false);
            },
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                self._componentdata = data;
                self.buildParameters();
                console.log("Done parameter init");
                self.parametersInitialised();
            },
        });
    },

    // clear everything and start over...
    reinit: function() {
        this._container.html("");
        this.init();
    },

    // callbacks
    parametersInitialised: function() {
    },

    // load an object containing param data...
    // data looks like:
    // {
    //      binarizer: "BinarizeByHT",
    //      BinarizeByHT__k1:  0.1,
    // }
    loadData: function(data) {
        var self = this;                  
        $.each(data, function(key, value) {
            var ctype = self._namemap[key.match(/(\w+?)(\d*)$/)[1]];
            console.log("CType: " + ctype);
            if (ctype && self._componentdata[value] && !key.match(/__/)) {
                var sel = $("#" + key);
                if (sel.length) {
                    sel.val(value);
                } else {
                    // add a multi component select with a blank
                    // option
                    console.log("Key: " + key + ", Value: " + value);
                    self.addComponentSelect(key, key, value, true);
                    self.renumberMultiComponents(key);
                    sel = $("#" + key);
                }
                sel.trigger("change");
            }
        });

        // set the component parameter values
        $.each(data, function(key, value) {
            if (key.match(/__/)) {
                $("#" + key).val(value);
            }
        });

        // strip any components not in the preset
        $(".ocroption").each(function(i, comp) {
            var id = $(comp).attr("name");
            if (!data[id]) {
                $(comp).parent("div").parent("div").remove();
            }
        });
    },

    /*
     *  Private stuff =========================================================
     */

    _sortByName: function(a, b) {
        var x = a.name;
        var y = b.name;
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    },

    // when the user adds another multi-component (binclean1-10),
    // renumber them accordingly
    renumberMultiComponents: function(compname) {
        var basename = compname.match(/(\w+?)(\d+)$/)[1];
        var count = 0;
        $("select[name^='" + basename + "']").each(function(i, sel) {
            var newname = basename + count;
            $(sel).attr("name", newname).attr("id", newname);
            $(sel).parent().prev("label")
                .text(newname)
                .attr("for", newname);
            $(sel).parent().nextAll("div").attr("id", newname + "_options");
            count++;
        });

        // if there's only one of a given component, disable the
        // delete button...
        $("select[name^='" + basename + "']").nextAll("input.remmulti")
            .attr("disabled", count == 1);

    },

    // construct a UI containing the registered components, with
    // the fetched default parameter info...
    buildParameters: function() {
        if (this._metacomponent) {
            this.buildMetaComponentSet();
        } else {
            this.buildRegisteredComponentSet();
        }
    },

    // use a particular component to provide a template
    // for the full component set
    buildMetaComponentSet: function() {
        var metacomp = this._componentdata[this._metacomponent];

        // sort the list alphabetically - affects the
        // original data but we don't care
        metacomp.params.sort(this._sortByName);

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
        var self = this;                               
        $.each([splist, mplist], function(i, list) {
            $.each(list, function(i, param) {
                if (param.value) {
                    self.addComponentSelect(param.name, param.name, param.value, true);
                }
            });
        });
    },

    buildRegisteredComponentSet: function() {
        for (var i in this._components) {
            var comp = this._components[i];
            this.addComponentSelect(comp.name, comp.label, comp.defvalue, comp.blank);
        }
    },

    // get the component type for a string name like
    // binclean0 -> ICleanupBinary.  This is listed
    // in the namemap but we also need to strip of
    // any numeric suffix
    getComponentType: function(compname) {
        var ctype = this._namemap[compname.match(/(\w+?)(\d*)$/)[1]];
        if (!ctype) {
            throw "Bad component type string: '" + compname + 
                "'.  Expecting something like 'binclean0', 'binarizer'";
        }
        return ctype; 
    },

    setComponentParams: function(compname, pdiv) {
        pdiv.html("");
        if (!compname || compname == "-") {
            return;
        }
        var plabel = $("<label></label>");
        var pinput = $("<input type='text'></input>");
        for (var i in this._componentdata[compname].params) {
            var param = this._componentdata[compname].params[i];
            var pname = compname + "__" + param.name;
            pdiv.append(plabel.clone().text(param.name).attr("for", pname));    
            pdiv.append(
                pinput.clone()
                    .attr("name", pname).attr("id", pname)
                    .val(param.value));
        }

    },

    // get a list of components for a param name like 'binarize'
    getComponentOptions: function(name) {
        var comptype = this.getComponentType(name);
        var complist = [];
        for (var cname in this._componentdata) {
            var comp = this._componentdata[cname];
            // skip metacomponent or those of different types
            if (comp.type != comptype || 
                    (this._metacomponent && this._metacomponent == comp.name)) {
                continue;
            }
            complist.push(comp);
        }
        complist.sort(this._sortByName);
        return complist;
    },

    // add a select with component selection options
    addComponentSelect: function(name, label, def, blank) {
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
        var add = $("<input type='button' />")
            .addClass("addmulti")
            .attr("value", "+");
        var rem = $("<input type='button' />")
            .addClass("remmulti")
            .attr("value", "-");

        if (blank) {
            sel.append($("<option></option>").attr("value", "-"));
        }
        $.each(this.getComponentOptions(name), function(i, comp) {
            sel.append($("<option></option>")
                    .attr("value", comp.name)
                    .text(comp.name)); 
        });
        if (def) {
            sel.attr("value", def);
            this.setComponentParams(def, pdiv);
        }
        var div1 = $("<div></div>").append(lab);
        var div2 = $("<div></div>").addClass("compsel").append(sel);
        if (name.match(/\d+$/)) {
            div2.append(add).append(rem);
        }
        this._container.append(div1.append(div2).append(pdiv));
    },

});

