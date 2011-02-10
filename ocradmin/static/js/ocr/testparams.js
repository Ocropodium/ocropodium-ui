

OCRJS = OCRJS || {};
OCRJS.TestParameterBuilder = OCRJS.OcrBase.extend({
    constructor: function(parent) {
        this.base(parent);
        this.parent = parent;
        this.init();

        this._ctrl_prefix = "ocr_ctrl_";
    },

    init: function() {
        var self = this;
        self.queryOptions(null, []);
    },

    queryOptions: function(parent, urlparts, func) {
        var self = this;
        var parent = parent || self.parent;
        var queryurl = "/ocrplugins/query/" + urlparts.join("/");
        var func = func || function(data) {
            self.buildSection(parent, data);                
        }; 
        console.log(queryurl);
        $.ajax({
            url: queryurl,
            type: "GET",
            error: OCRJS.ajaxErrorHandler,
            success: func,
        });
    },

    buildSection: function(parent, data) {
        // if the data has options then build a 
        // select drop-down.  Use an input and
        // enter the (possibly null) data.value
        var self = this;
        if (!data)
            return;
        var parent = parent || self.parent;
        var ident = parent.id + ":" + data.name;
        var container = $("<div></div>")
            .attr("id", ident)
            .addClass("param_section");
        if (data.choices) {
            if (data.choices.constructor != Array) {
                console.log("Fetching uncached options: " + data.name);
                var parts = ident.split(":").splice(2);
                parts.push(data.name);
                self.queryOptions(container.get(0), parts); 
            } else {
                self.buildOptionSection(container, ident, data);
            }
        } else if (data.parameters) {
            $.each(data.parameters, function(i, param) {
                self.buildSection(container.get(0), param);
            });
        } else {
            self.buildParameterSection(container, ident, data);
        }

        return container.appendTo(parent);
    },

    buildOptionSection: function(container, ident, data) {
        var self = this;                            
        var label = $("<label></label>")
            .text(data.name)
            .attr("title", data.description);
        var control = $("<select></select>")
            .attr("name", "$" + ident);
        var opt = $("<option></option>");
        $.each(data.choices, function(i, choice) {                    
            opt.clone()
                .attr("value", choice.value == null ? choice.name : choice.value)
                .attr("title", choice.description)
                .text(choice.name)
                .appendTo(control);
        });
        console.log("Hooking up: " + data.name);
        control.change(function(event) {
            var parts = ident.split(":").splice(2);
            parts.push($(this).val());
            self.queryOptions(container.get(0), parts, function(newdata) {
                container.children("div").html(
                    self.buildSection(container.get(0), newdata)
                )
            });
        });
        if (data.choices.length) {
            self.loadOptionState(control, data.choices[0].name);
            control.change();
        }
        container.append(label).append(control);
    },                  

    buildParameterSection: function(container, ident, data) {
        var label = $("<label></label>")
            .text(data.name).attr("title", data.description);
        var control = $("<input></input>").attr("name", "$" + ident);
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

    pbuilder = new OCRJS.TestParameterBuilder(document.getElementById("options"));
});
