//
// Interface for node parameters
//

OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};


OCRJS.Nodetree.Parameters = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(options);
        this.parent = parent;

        this._paramtmpl = $.template($("#paramTmpl"));
        this._node = null;

        this._listeners = {
            parameterSet: [],
            registerUploader: [],
        };
    },                     

    buildParams: function() {
        var self = this,
            node = this._node;

        $(this.parent).html("").append(
            $.tmpl(this._paramtmpl, {
                nodename: node.name
            }));

        for (var i in node.parameters) {
            switch (node.parameters[i].type) {
                case "filepath":
                    this._buildFileParam(node, node.parameters[i]);
                    break;
                case "bool":
                    this._buildBooleanParam(node, node.parameters[i]);
                    break;
                default: {
                    if (node.parameters[i].choices)
                        this._buildChoiceParam(node, node.parameters[i]);
                    else
                        this._buildParam(node, node.parameters[i]);
                }
            }                
        }            
    },

    clearParams: function() {
        $(this.parent).html("");
    },

    updateParams: function() {
        var self = this,
            node = this._node;

        for (var i in node.parameters) {
            console.log("Updating param val", node.parameters[i].name, node.parameters[i].value);
            var row = $($("#node_param_list", this.parent).find("tr")[i]);
            var control = $(row.find("input, select").not(".proxy")[i]);
            if (this._getControlValue(control) != node.parameters[i].value)
                this._setControlValue(control, node.parameters[i].value);
        }            
    },                      

    resetParams: function(node) {

        if (!node) {
            this._node = null;
            this.clearParams();
        } else {
            if (!this._node || this._node != node) {
                if (this._node)
                    this._node.removeListeners(".paramchange");
                this._node = node;
                this.buildParams();
            } else {
                this.updateParams();
            }
        }
    },

    _buildFileParam: function(node, param) {
        var control = $("<input type='text'></input"),
            label = $("<label></label>"); 
        control
            .attr("id", node.name + param.name)
            .val(param.value);
        label
            .attr("for", node.name + param.name)
            .text(param.name);
        var wrap = $("<div></div>")
            .attr("id", "dropzone")
            .append(control);
        this._addControl(label, wrap);
        this._setupEvents(node, param, control);
        this.callListeners("registerUploader", node.name, control);
    },

    _buildBooleanParam: function(node, param) {    
        var control = $("<input type='checkbox'></input"),
            label = $("<label></label>"); 
        control
            .attr("id", node.name + param.name)
            .prop("checked", param.value);
        label
            .attr("for", node.name + param.name)
            .text(param.name);
        this._addControl(label, control);
        this._setupEvents(node, param, control);

    },

    _buildChoiceParam: function(node, param) {
        var control = $("<select></select"),
            label = $("<label></label>");
        $.each(param.choices, function(i, choice) {
            var opt = $("<option></option>")
                    .attr("value", choice)
                    .text(choice);
            if (choice == param.value)
                opt.attr("selected", "selected");
            control.append(opt);
        }); 
        control
            .attr("id", node.name + param.name)
            .val(param.value);
        label
            .attr("for", node.name + param.name)
            .text(param.name);
        this._addControl(label, control);
        this._setupEvents(node, param, control);
    },

    _buildParam: function(node, param) {
        var control = $("<input type='text'></input"),
            label = $("<label></label>"); 
        control
            .attr("id", node.name + param.name)
            .val(param.value);
        label
            .attr("for", node.name + param.name)
            .text(param.name);
        this._addControl(label, control);
        this._setupEvents(node, param, control);
    },

    _addControl: function(label, control) {
        var tab = $("#node_param_list", this.parent);
        var row = $("<tr></tr>").addClass("node_parameter");
        tab.append(row);
        row
            .append($("<td></td>").append(label))
            .append($("<td></td>").append(control));
    },                     

    _setupEvents: function(node, param, control) {
        var self = this,                      
            listenername = "parameterUpdated_" + param.name + ".paramchange";

        // to prevent a circular loop we have to unbind the 
        // listener, change the value, and rebind it.
        control.bind("change", function(event) {
            self.callListeners("parameterSet", node, param.name, self._getControlValue(control));
        });
    },

    _getControlValue: function(control) {
        var val;                       
        switch (control.attr("type")) {
            case "checkbox":
                val = control.prop("checked");
                break;
            case "radio":
                val = "TODO";
                break;
            default:
                val = control.val();
        }
        return val;        
    },             

    _setControlValue: function(control, value) {
        switch (control.attr("type")) {
            case "checkbox":
                control.prop("checked", value);
                break;
            default:
                control.val(value);
        }        
    },                          
});

