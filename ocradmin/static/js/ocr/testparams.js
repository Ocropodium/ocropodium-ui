
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

OCRJS = OCRJS || {};
OCRJS.TestParameterBuilder = OCRJS.OcrBase.extend({
    constructor: function(parent) {
        this.base(parent);
        this.parent = parent;
        this.init();

        this._cache = null;
        console.log("Called constructor");
    },

    init: function() {
        var self = this;
        self.setupEvents();
        self.queryOptions(null, null);
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
                .appendTo(ctrl)
                .css("float", "left");
            var minus = $("<div></div>")
                .addClass("ui-icon ui-icon-minus")
                .addClass("control_manip_remove")
                .appendTo(ctrl)
                .data("ctrl", this)
                .css("float", "left");
            ctrl.css({
                position: "absolute",
                float: "left",
                width: "40px",
                top: select.position().top,
                left: select.position().left + select.width(),
            }).appendTo(this);
        }).live("mouseleave", function(event) {
            $(".control_manip", this).remove();
        });

        $(".control_manip_remove").live("click", function(event) {
            var elem = $(this).data("ctrl");
            $(elem).detach();
            self.renumberMultiples();
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
        var url = "/ocrplugins/query/";
        $.ajax({
            url: url,
            type: "GET",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                self._cache = data;
                $(parent).append(
                    self.buildSection(parent, data)
                );
            },
        });
    },

    getIdent: function(parent, data, index) {
        var ident;
        if (index != null)
            ident = parent.id + "[" + index + "]" + "." + data.name;
        else
            ident = parent.id + "." + data.name;
        return data.multiple ? (ident + "[0]") : ident;
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
            self.buildChoicesSection(container, ident, data);
        } else if (data.parameters) {
            self.buildParameterList(parent, container, ident, data);
        } else {
            self.buildParameterSection(container, ident, data);
        } 
        return container;
    },

    buildChoicesSection: function(container, ident, data) {
        var self = this;                             
        // fetch more data if we need to...
        if (data.choices === true) {
            var parts = ident.replace(/\[\d+\]/g, "").split(".").splice(2);
            //parts.push(data.name);
            $.getJSON("/ocrplugins/query/" + parts.join("/") + "/", function(data) {
                self.buildChoicesSection(container, ident, data);
            });
            return;
        }

        var label = $("<label></label>")
            .attr("for", ident + "_ctrl")
            .attr("title", data.description)
            .text(data.name)
            .appendTo(container);
        var control = $("<select></select>")
            .attr("id", ident + "_ctrl")
            .addClass("option_select")
            .attr("name", "$" + ident)
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
        if (data.choices.length) {
            self.loadOptionState(control, data.choices[0].name);
            control.change();
        }
    },                  

    buildParameterList: function(parent, container, ident, data) {
        var self = this;

        // fetch more data if we need to...
        if (data.parameters === true) {
            var parts = ident.replace(/\[\d+\]/g, "").split(".").splice(2);
            $.getJSON("/ocrplugins/query/" + parts.join("/") + "/", function(data) {
                var section = self.buildSection(parent, data);
                if ($(parent).children("div").length)
                    $(parent).children("div").replaceWith(section);
                else
                    $(parent).append(section);                    
            });
            return;
        }

        $.each(data.parameters, function(i, param) {
            //console.log("Building param for: " + i + " " + param.name + " ", param);
            container.append(
                self.buildSection(container.get(0), param, i)
            );
        });        
    },

    buildParameterSection: function(container, ident, data) {                               
        if (!(data.value || data.parameters || data.choices))
            return;
        var label = $("<label></label>")
            .attr("for", ident + "_ctrl")
            .text(data.name).attr("title", data.description);
        var control = $("<input></input>")
            .attr("id", ident + "_ctrl")
            .attr("name", "$" + ident);
        if (data.type == "bool")
            control.attr("type", "checkbox");
        this.loadOptionState(control, data.value);
        container.append(label).append(control);
    },
                           
    saveState: function() {
        $("select, input", $("#options")).each(function(index, item) {
            if ($(item).attr("type") == "checkbox")
                $.cookie($(item).attr("name"), $(item).attr("checked"));
            else
                $.cookie($(item).attr("name"), $(item).val());
        });
    },

    loadOptionState: function(item, defaultoption) {
        // check for a cookie with the given 'name'
        // otherwise, select the first available option
        var val = $.cookie(item.attr("name"));
        if (!val)
            val = defaultoption;

        item.val(val);
        if (item.attr("type") == "checkbox") {
            item.attr("checked", !(parseInt(val) == 0 || val == "false"
                        || val == "off"));
        }
    },
});


var pbuilder = null;

$(function() {

    // save state on leaving the page... at least try to...
    window.onbeforeunload = function(event) {
        pbuilder.saveState();
    }

//    pbuilder = new OCRJS.TestParameterBuilder(document.getElementById("options"));
});
