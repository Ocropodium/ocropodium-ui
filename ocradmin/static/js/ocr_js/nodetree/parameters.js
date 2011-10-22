//
// Interface for node parameters
//

var OcrJs = OcrJs || {};
OcrJs.Nodetree = OcrJs.Nodetree || {};

var NT = OcrJs.Nodetree;

NT.TextParam = OcrJs.Base.extend({
    init: function(node, param, options) {
        this._super(node, param, options);
        this.node = node;
        this.data = param;
        this.name = node.name + param.name;
        this.options = {};
        $.extend(this.options, options);
        this._initCtrl();
        this._bindCtrl();

        this._listeners = {
            change: [],
        };
    },      

    _initCtrl: function() {
        this.ctrl = $("<input type='text'></input>");
        this.ctrl
            .attr("id", this.name);
        this.setValue(this.data.value);
    },

    _bindCtrl: function() {
        var self = this;                   
        this.ctrl.bind("change.paramupdate", function(event) {
            self.trigger("change", self.getValue());            
        });            
    },                   

    setValue: function(val) {
        this.ctrl.val(val);
    },                  

    getValue: function() {
        return this.ctrl.val();
    },                  

    getLabel: function() {
        return $("<label></label>")
            .attr("for", this.name)
            .text(this.data.name);
    },                  

    buildHtml: function() {
        return $("<tr></tr>")
            .addClass("node_parameter")
            .append($("<td></td>").append(this.getLabel()))
            .append($("<td></td>").append(this.ctrl));                        
    }                   
});

NT.ChoiceParam = NT.TextParam.extend({
    _initCtrl: function() {
        var self = this;                   
        this.ctrl = $("<select></select");
        $.each(this.data.choices, function(i, choice) {
            var opt = $("<option></option>")
                    .attr("value", choice)
                    .text(choice);
            if (choice == self.data.value)
                opt.attr("selected", "selected");
            self.ctrl.append(opt);
        }); 
        this.ctrl
            .attr("id", this.name);
        this.setValue(this.data.value);
    },              
});

NT.BooleanParam = NT.TextParam.extend({
    _initCtrl: function() {
        this.ctrl = $("<input type='checkbox'></input>");
        this.ctrl
            .attr("id", this.name);
        this.setValue(this.data.value);
    },                   

    setValue: function(val) {
        this.ctrl.prop("checked", val);
    },

    getValue: function() {
        return this.ctrl.prop("checked");
    },                  
});

NT.FileParam = NT.TextParam.extend({
    _initCtrl: function() {
        this._super();
        this.ctrl
            .addClass("dropzone")
            .attr("disabled", true);
    },

    setValue: function(val) {
        this.ctrl
            .data("val", val)
            .val(val.match(/.*?([^\/]+)?$/)[1]);            
    },

    getValue: function() {
        return this.ctrl.data("val");
    },                  
});

NT.SwitchParam = NT.TextParam.extend({
    _initCtrl: function() {
        this.ctrl = $("<span></span>")
            .attr("id", this.name)
            .css("float", "left")
            .css("width", "90%")
            .slider({
                value: this.data.value,
                min: 0,
                step: 1,
                max: 1,
            });
    },

    _bindCtrl: function() {
        var self = this;                   
        this.ctrl.slider({
            stop: function(event, ui) {
                self.trigger("change", self.getValue());            
            },
        });
    },                   

    setValue: function(val) {
        this.ctrl.slider("value", val);
    },

    getValue: function() {
        return this.ctrl.slider("value");
    },                  
});    


NT.Parameters = OcrJs.Base.extend({
    init: function(parent, options) {
        this._super(options);
        this.parent = parent;

        this._paramtmpl = $.template($("#paramTmpl"));
        this._node = null;

        this._params = [];

        this._listeners = {
            parameterSet: [],
            registerUploader: [],
        };
    },

    newParam: function(data) {
        switch(data.type) {
            case "switch": return new NT.SwitchParam(this._node, data);
            case "bool": return new NT.BooleanParam(this._node, data);
            case "filepath": return new NT.FileParam(this._node, data);
            default: 
                if (data.choices)
                    return new NT.ChoiceParam(this._node, data);
                else
                    return new NT.TextParam(this._node, data);
        }                                             
    },                  

    setupParameterEvents: function(param) {
        var self = this;                              
        param.addListeners({
            change: function(val) {
                self.trigger("parameterSet", self._node, param.data.name, val);
            },
        });        

        // FIXME: Hack to wire in uploader events to file path controls
        if (param.data.type == "filepath")
            this.trigger("registerUploader", this._node.name, param.ctrl);
    },                              

    buildParams: function() {
        var self = this,
            node = this._node;

        this._params = [];
        $(this.parent).html("").append(
            $.tmpl(this._paramtmpl, {
                nodename: node.name
            }));

        var tab = $("#node_param_list", this.parent);
        for (var i in node.parameters) {
            var p = this.newParam(node.parameters[i]);
            this._params.push(p);
            tab.append(p.buildHtml());
            this.setupParameterEvents(p);
        }            
    },

    clearParams: function() {
        $(this.parent).html("");
        this._params = [];
    },

    updateParams: function() {
        for (var i in this._node.parameters)
            this._params[i].setValue(this._node.parameters[i].value);
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
});

