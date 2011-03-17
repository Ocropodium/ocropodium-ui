
RegExp.escape = function(text) {
  if (!arguments.callee.sRE) {
    var specials = [
      '/', '.', '*', '+', '?', '|',
      '(', ')', '[', ']', '{', '}', '\\'
    ];
    arguments.callee.sRE = new RegExp(
      '(\\' + specials.join('|\\') + ')', 'g'
    );
  }
  return text.replace(arguments.callee.sRE, '\\$1');
}

function toCamelCase(str) {
    return str.replace(/_/g, " ").replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}


function defined(x) {
    return typeof(x) !== "undefined";
}

function isnull(x) {
    return x === null;
}


OCRJS = OCRJS || {};
OCRJS.countProperties = function(obj) {
    var count = 0;
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            ++count;
        }
    }
    return count;
};


OCRJS._ajaxCache = {};


OCRJS.ParameterBuilder = OCRJS.OcrBase.extend({
    constructor: function(parent, valuedata) {
        this.base(parent);
        this.parent = parent;

        this._listeners = {
            onReadyState: [],
            onUpdateStarted: [],
        };
        this._valuedata = valuedata || null;
        this._cache = null;
        this._temp = null;
        this._waiting = {};
    },

    init: function() {
        var self = this;
        self.setupEvents();
        self.queryOptions(null, null);
    },

    isReady: function() {
        return OCRJS.countProperties(this._waiting) > 0 ? false : true;
    },

    setupEvents: function() {
        var self = this;
        $(".multiple").live("mouseenter", function(event) {
            var select = $(this).children("select").first();
            var ctrl = $("<div></div>")
                .addClass("control_manip");
            var plus = $("<div></div>")
                .addClass("ui-icon ui-icon-plus")
                .addClass("control_manip_add")
                .data("ctrl", this)
                .appendTo(ctrl);
            var minus = $("<div></div>")
                .addClass("ui-icon ui-icon-minus")
                .addClass("control_manip_remove")
                .appendTo(ctrl)
                .data("ctrl", this)
                .toggle($(this).siblings().length > 0);
            ctrl.css({
                top: select.position().top,
                left: select.position().left + select.width(),
            }).appendTo(this);
        }).live("mouseleave", function(event) {
            $(".control_manip", this).remove();
        });

        $(".control_manip_remove").live("click", function(event) {                
            var elem = $(this).data("ctrl");
            if ($(elem).siblings().length > 0) {
                var id = $(elem).find("select").first().attr("id");
                $(elem).remove();
                self.renumberMultiples(id);
            }
        });

        $(".control_manip_add").live("click", function(event) {            
            var elem = $(this).data("ctrl");
            // clone the element with both data and events,
            // then remove any existing hover controls and
            // trigger a rebuild of the section
            var clone = $(elem).clone(true)  
                .find(".control_manip")      
                .remove()
                .end()
                .insertAfter(elem)
                .find("select")
                .change();
        });
    },

    renumberMultiples: function(baseid) {
        var base = baseid.replace(/\[\d+\]_ctrl$/, "");                           
        var re = new RegExp(RegExp.escape(base) + "\\[\\d+\\]", "g");
        $(".multiple[id^='" + base + "']").each(function(index, elem) {
            var newid = base + "[" + index + "]";                        
            $(elem).attr("id", $(elem).attr("id").replace(re, newid))
                .find("*").each(function(i, e) {
                $.each(e.attributes, function(j, attrib) {
                    if (attrib.value.match(re)) {
                        attrib.value = attrib.value.replace(re, newid);
                    }
                });
            });
        });
    },                 

    queryOptions: function(parent) {
        var self = this;
        var parent = parent || self.parent;
        var url = "/plugins/query/";
        self._waiting[parent.id] = true;
        self.callListeners("onUpdateStarted"); 
        $.ajax({
            url: url,
            type: "GET",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                self._temp = self.buildSection(parent, data)
                self._queryDone(parent.id);
            },
        });
    },

    getIdent: function(parent, data, index, multiindex) {
        var ident;
        if (index !== undefined)
            ident = parent.id + "[" + index + "]" + "." + data.name;
        else
            ident = parent.id + "." + data.name;
        if (multiindex !== undefined)
            ident = ident + "[" + multiindex + "]";
        return ident;
    },

    getKeyName: function(ident, data, index) {
        var iname = ident.replace(/\[(\d+)\]$/, "[" + index + "]", ident);
        return (data.type == "list"
                ? "@"
                : (data.type == "object" ? "%" : "$")) + iname;
    },              

    buildSection: function(parent, data, index) {
        // build a section for one parameter and its
        // children
        if (!data)
            return;        
        var self = this;
        var ident = self.getIdent(parent, data, index);
        var container = $("<div></div>")
            .attr("id", ident)
            .addClass("param_section");
        if (data.choices) {
            if (data.multiple) {
                var mtemp = container.clone();
                mcount = 0;
                while (true) {
                    var mident = self.getIdent(parent, data, index, mcount);
                    var stored = self._storedValue(mident);
                    if (stored === null || !defined(stored)) {
                        if (typeof data.value == "object" && data.value.length > 0) {
                            stored = data.value[mcount];
                        }
                    }
                    if ((isnull(stored) || !defined(stored)) && mcount > 0)
                       break; 
                    var mcontainer = mtemp.clone()
                        .attr("id", mident);
                    container.append(mcontainer);
                    self.buildChoicesSection(mcontainer, mident, data, mcount);
                    mcount++;
                }
            } else
                self.buildChoicesSection(container, ident, data);
        } else if (data.parameters) {
            //console.log("Building parameter section: ", data.parameters);
            self.buildParameterList(parent, container, ident, data);
        } else {
            self.buildParameterSection(container, ident, data);
        } 
        return container;
    },

    fetchData: function(ident, callback) {
        var self = this;
        var parts = ident.replace(/\[\d+\]/g, "").split(".").splice(2);
        self._waiting[ident] = true;
        self.callListeners("onUpdateStarted"); 
        $.ajax({
            url: "/plugins/query/" + parts.join("/") + "/",
            success: function(data) {
                callback.call(self, data);
                self._queryDone(ident);
            },
        });
    },                  

    buildChoicesSection: function(container, ident, data, multiindex) {
        var self = this;                             
        // fetch more data if we need to...                      
        if (data.choices === true) {
            self.fetchData(ident, function(data) {
                self.buildChoicesSection(container, ident, data, multiindex);
            });
            return;
        }

        var ctrlname = self.getKeyName(ident, data, multiindex);
        var label = $("<label></label>")
            .attr("for", ident + "_ctrl")
            .attr("title", data.description ? data.description : data.name)
            .text(toCamelCase(data.name))
            .appendTo(container)
            .textOverflow("...", true);
        var control = $("<select></select>")
            .attr("id", ident + "_ctrl")
            .addClass("option_select")
            .attr("name", ctrlname)
            .appendTo(container);

        if (data.multiple)
            container.addClass("multiple");
        
        var option = $("<option></option>");
        $.each(data.choices, function(i, choice) {
            control.data(choice.name, choice);
            option.clone()
                .attr("value", choice.value == null ? choice.name : choice.value)
                .text(choice.name)
                .appendTo(control);
        });
        control.change(function(event) {
            var newdata = $(this).data($(this).val());
            var section = self.buildSection(container.get(0), newdata); 
            if ($(this).next("div").length)
                $(this).next("div").replaceWith(section);
            else
                container.append(section);                    
            self.renumberMultiples(this.id);
        });

        // if we have some choices, select the last cached
        // and then trigger a change event to build any children
        if (data.choices.length) {
            var value = data.choices[0].name;
            if (!defined(multiindex) && defined(data.value))
                value = data.value;
            else if (defined(multiindex) && !defined(data.value))
                value = data.value[multiindex];
            self.loadOptionState(control, value);
            control.change();
        }
    },                  

    buildParameterList: function(parent, container, ident, data) {
        var self = this;

        // fetch more data if we need to...
        if (data.parameters === true) {
            self.fetchData(ident, function(data) {
                var section = self.buildSection(parent, data);
                if ($(parent).children("div").length)
                    $(parent).children("div").replaceWith(section);
                else
                    $(parent).append(section);                    
            });
            return;
        }

        $.each(data.parameters, function(i, param) {
            //console.log("param: ", param);
            container.append(
                self.buildSection(container.get(0), param, i)
            );
        });        
    },

    buildParameterSection: function(container, ident, data) {
        var self = this;
        if (!(defined(data.value) || data.parameters || data.choices))
            return;
        var label = $("<label></label>")
            .attr("for", ident + "_ctrl")
            .text(toCamelCase(data.name))
            .attr("title", data.description ? data.description : data.name)
            .appendTo(container)
            .textOverflow("...", true);
        var control = $("<input></input>")
            .attr("id", ident + "_ctrl")
            .attr("type", data.type == "bool" ? "checkbox" : "text")
            .attr("name", self.getKeyName(ident, data))
            .appendTo(container);
        self.loadOptionState(control, data.value);
    },
                           
    saveState: function() {
        if (this._valuedata !== null)
            return;
        // Delete all existing state cookies
        var val = {};
        $("select, input", this.parent).each(function(index, item) {
            var key = $(item).attr("name").substr(1);
            if ($(item).attr("type") == "checkbox")
                val[key] = $(item).attr("checked");
            else
                val[key] = $(item).val();
        });
        $.cookie("ocr-parameters", JSON.stringify(val));
    },

    loadOptionState: function(item, defaultoption) {
        // check for a cookie with the given 'name'
        // otherwise, select the first available option
        var key = item.attr("name").substr(1);
        var val = this._storedValue(key);
        var setval = val ? val : defaultoption;
        if (item.attr("type") != "checkbox") {
            item.val(setval);
        } else {
            item.attr("checked", !(parseInt(setval) == 0 || setval == "false"
                        || setval == "off" || setval == false));
        }
        return val !== null ? true : false;
    },

    serializedData: function() {
        return $("input, select", this.parent).serialize();
    },

    setFromData: function(data) {
        $("input, select", this.parent).each(function(index, elem) {
            // get the element name and cut off the object type
            // prefix                    
            var key = $(elem).attr("name").substr(1);
            if (data[key]) {
                //console.log("Restoring parameter: ", key);
                $(elem).val(data[key]);
            }
        });
    },

    _queryDone: function(key) {
        delete this._waiting[key];                    
        if (this.isReady()) {
            $(this.parent).append(this._temp);
            this.callListeners("onReadyState"); 
        }
    },

    _storedValue: function(key) {
        if (this._valuedata !== null) {
            return this._valuedata[key];
        } else {
            if (this._cache === null) {
                var val = $.cookie("ocr-parameters");
                this._cache = val ? JSON.parse(val) : {};
            }
            return this._cache[key];
        }
    },                


    /*
     * Not currently working attempt to get the browser
     * to cache the results of plugin REST caches, where
     * nothing much really changes
     *
     */
    _cachedAjax: function(options) {
        var self = this;
        if (typeof OCRJS._ajaxCache[options.url] != "undefined") {
            var data = OCRJS._ajaxCache[options.url];
            options.success.call(this, data);
        } else {
            var orig = options.success;
            var newfunc = function(data) {
                //console.log("Caching url: ", options.url);
                OCRJS._ajaxCache[options.url] = data;
                orig.call(this, data);    
            };
            options.success = newfunc;
            $.ajax.call(this, options);
        }        
    },
});


