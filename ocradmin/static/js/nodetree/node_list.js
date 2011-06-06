// 
// Basic parameter builder...
//

OCRJS.Nodetree.NodeList = OCRJS.OcrBase.extend({
    constructor: function(parent, valuedata) {
        this.base(parent);
        this.parent = parent;

        this._listeners = {
            onUpdateStarted: [],
            resultPending: [],
            registerUploader: [],
        };
        this._nodelisttmpl = $.template($("#nodeListTmpl"));
        this._nodetreetmpl = $.template($("#nodeTreeTmpl"));
        this._paramtmpl = $.template($("#paramTmpl"));
        this._nodeslottmpl = $.template($("#nodeSlots"));

        this._nodes = [];
        this._nodedata = {};
        this._nodetypes = {};
        this._usednames = {};
        this._sessionid = null;
    },

    init: function() {
        this.queryNodeTypes();
    },

    setNodeErrored: function(nodename, error) {
        if (!this._usednames[nodename])
            throw "Unknown node name: " + nodename;
        this._usednames[nodename].setErrored(true, error);
    },                        

    newNodeName: function(type) {
        var count = 1;
        var tname = $.trim(type);
        var space = type.match(/\d$/) ? "_" : "";
        while (this._usednames[tname + space + count])
            count += 1;
        return (tname + space + count).replace(/^[^:]+::/, "");
    },

    removeNode: function(elem) {
        delete this._usednames[$(elem).attr("name")];
        $(elem).remove();
        this.scriptChange();        
    },

    selectLastNode: function() {
        $(".used li").last().click();        
    },                

    setupEvents: function() {
        var self = this;

        $("#run_script").click(function(event) {
            self.runScript();
            event.preventDefault();
        });

        $("#optionsform").submit(function(event) {
            self.runScript();
            event.preventDefault();
            event.stopPropagation();
        });

        // HACK: see:
        // http://stackoverflow.com/questions/5020695/jquery-draggable-element-no-longer-draggable-after-drop
        $.ui.draggable.prototype.destroy = function (ul, item) { };

        $(".available h4").click(function(event) {
            $(".available ul").not(this).hide();
            $(this).next("ul").show();

        });

        $(window).keydown(function(event) {
            if (event.which == KC_DELETE) {
                var current = $(".node.current");
                if (current.length == 0)
                    return;
                //if (confirm("Remove node: " + current.attr("name")))
                current.data("nodedata").removeNode();
            }
        });

        $(".nodelist.available").find("li.node").each(function(i, elem) {
            $(elem).draggable({
                scope: $(elem).data("stage"),
                    //helper: "clone",
                    helper: function() {
                        var helper = $(this).clone(true);
                        helper.text(
                            self.newNodeName($(this).data("type").replace(/^[^:]+::/, "")));
                        return helper.get(0);                                        
                    },
                    stop: function() {
                        $(this).addClass("ui-draggable");
                    },
                    //connectToSortable: ".nodelist.used ul",
                    opacity: 0.8,        
                });
        });

        $(".nodelist.used ul").each(function(i, elem) {
            $(elem).droppable({
                hoverClass: "drop_target",
                scope: $(elem).data("stage"),
                activate: function(event, ui) {
                    $(this).addClass("drop_possible");
                },
                deactivate: function(event, ui) {
                    $(this).removeClass("drop_possible");
                },
                drop: function(event, ui) {
                    if (ui.draggable.hasClass("available")) {
                        var node = self.addNode(ui.helper.text(), 
                                ui.draggable.data("nodedata"));
                        if ($(this).hasClass("multiple"))
                            node.elem.appendTo(this);
                        else
                            $(this).children().remove().end()
                                .append(node.elem);
                        node.elem.click();                        
                    }
                }, 
            }).sortable({
                containment: "parent",    
            });
        });
    },

    addNode: function(name, typedata) {
        var id = $.map(this._usednames, function(){return true;}).length;
        var node = new NT.Node(name, typedata, id);
        node.buildElem();
        this.setupNodeListeners(node);
        this._usednames[name] = node;
        this._nodes.push(node);
        return node;

    },                 

    setupNodeListeners: function(node) {
        var self = this;                            
        node.addListeners({
            toggleIgnored: function(ig) {
                self.scriptChange();
            },
            toggleFocussed: function(foc) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != name)
                        other.setFocussed(false);
                });
                self.buildParams(node.name, node.parameters);
                self.scriptChange();
            },
            toggleViewing: function(view) {
                $.each(self._usednames, function(name, other) {
                    if (node.name != other.name)
                        other.setViewing(false);
                });
                self.scriptChange();
            },
            deleted: function() {
                console.log("Deleted node: ", node.name);
                self.scriptChange();
            },
        });
    },

    setNodeErrored: function(nodename, error) {
        if (!this._usednames[nodename])
            throw "Unknown node name: " + nodename;
        this._usednames[nodename].setErrored(true, error);
    },                        

    scriptChange: function() {
        this.runScript();
    },                 

    buildParams: function(name, params) {
        var self = this;
        $("input").unbind("keyup.paramval");
        $("#parameters").html("");
        $("#parameters").append(
            $.tmpl(self._paramtmpl, {
                nodename: name,
                params: params,
            })
        );
        // bind each param to its actual value
        $.each(params, function(i, param) {
            $("input#" + name + param.name).not(".proxy").bind("keyup.paramval", function(event) {
                console.log("updating val", param.name);
                params[i].value = $(this).val();
            });
            $("select#" + name + param.name + " input[type='hidden']")
                    .bind("change.paramval", function(event) {
                params[i].value = $(this).val();
            });
            $("input[type='file'].proxy").each(function(i, elem) {
                self.callListeners("registerUploader", name, elem);
            });
        });        
    },                 

    queryNodeTypes: function() {
        var self = this;
        var url = "/plugins/query/";
        self.callListeners("onUpdateStarted"); 
        $.ajax({
            url: url,
            type: "GET",
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                self._nodedata = {};
                $.each(data, function(i, nodeinfo) {
                    if (!self._nodedata[nodeinfo.stage])
                        self._nodedata[nodeinfo.stage] = [];
                    self._nodedata[nodeinfo.stage].push(nodeinfo);
                    self._nodetypes[nodeinfo.name] = nodeinfo;
                });
                self.populateCanvas();                
            },
        });
    },

    populateCanvas: function() {
        $(this.parent).html("");
        $(this.parent).append($.tmpl(this._nodeslottmpl));
        this.populateAvailableList();

        this.setupEvents();
        this.loadState();
    },                        

    populateAvailableList: function() {
        var self = this;
        $.each(self._nodedata, function(stage, nodes) {
            $.each(nodes, function(i, node) {
                $(".available ul." + stage).append(
                    $.tmpl(self._nodelisttmpl, node)
                        .addClass("available")
                        .data("nodedata", node));
            });
        });
        $(".available ul").slice(1).hide();
        $(".available ul").filter(function() {
            return $(this).children().length > 0;
        }).first().show();
    },

    getEvalNode: function() {
        for (var i in this._nodes) {
            if (this._nodes[i].isViewing())
                return this._nodes[i].name;
        }    
        for (var i in this._nodes) {
            if (this._nodes[i].isFocussed())
                return this._nodes[i].name;
        }    
        for (var i in this._nodes) {
            if (this._nodes[i].stage == "recognize")
                return this._nodes[i].name;
        }    
        // fall back on the last node in the list
        return this._nodes[this._nodes.length - 1].name;
    },                     

    runScript: function() {
        var self = this;                   
        var script = self.buildScript();
        var nodename = self.getEvalNode();
        $.ajax({
            url: "/plugins/run",
            type: "POST",
            data: {
                script: JSON.stringify(script),
                node: nodename,
            },
            error: OCRJS.ajaxErrorHandler,
            success: function(data) {
                if (data.status == "VALIDATION") {
                    self._usednames[data.node].setErrored(true, data.error);
                } else {
                    $.map(self._nodes, function(n) {
                        n.setErrored(false);
                    });
                    self.callListeners("resultPending", nodename, data);
                }
            },
        });
    },

    setFileInPath: function(name, path) {
        console.log("Setting filein path", name, path);                       
        for (var n in this._nodes) {
            if (this._nodes[n].name == name) {
                var params = this._nodes[n].parameters;
                for (var i in params) {
                    console.log("Setting", params[i].name, path)
                    if (params[i].name == "path")
                        params[i].value = path;
                    break;
                }                
            }                
        }            
        this.scriptChange();
    },               

    // turn our GUI into an acceptable
    // script... hopefully...                           
    buildScript: function() {
        var self = this;
        var script = [];
        
        function scriptNode(node) {
            var arity = parseInt(node.arity);
            var args = Array.prototype.slice.call(arguments).slice(1, arity + 1);
            var params = [];
            $.each(node.parameters, function(i, p) {
                params.push([p.name, p.value]);
            });
            var out = {
                name: node.name,
                type: node.type,
                stage: node.stage,
                params: params,
                inputs: args,                    
            };
            if (node.isIgnored()) {
                out["ignored"] = true;
            }
            return out;
        }

        // this makes lots of assumptions about
        // where things are...
        var last = null, 
            segmenter = null,
            lastbinarizer = null,
            node = null;
        $(".nodelist.used ul")
                .filter(".input")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
            }).end().end()
                .filter(".filter_gray")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
            }).end().end()
                .filter(".binarize")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
            }).end().end()
                .filter(".filter_binary")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                last = node.name;
                lastbinarizer = node.name;
            }).end().end()
                .filter(".page_segment")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(scriptNode(node, last));
                segmenter = node.name;
                last = node.name;
            }).end().end()
                .filter(".recognize")
            .children().each(function(i, elem) {
                node = $(elem).data("nodedata");
                script.push(
                    scriptNode(node, lastbinarizer, segmenter));
            });
        return script;
    },

    loadScript: function(script) {
        var self = this;                    
        $.each(script, function(i, nodedata) {
            var typedata = self._nodetypes[nodedata.type];
            var node = self.addNode(nodedata.name, typedata);
            node.setIgnored(nodedata.ignored);
            $.each(nodedata.params, function(i, p) {
                node.parameters[i].value = p[1];
            });
            $(".used ul." + typedata.stage)
                .append(node.elem);
        });
        self.selectLastNode();
    },

    clearScript: function() {
        var self = this;
        $.each(this._nodes, function(i, n) {
            n.removeNode();
        });
        self._usednames = {};        
        self._nodes = [];
    },               

    buildSection: function(parent, data) {
        var self = this;
    },                  

    saveState: function() {
        $.cookie("preset", $("#select_script").val());                   
        $.cookie("script", JSON.stringify(this.buildScript()));
    },

    loadState: function() {
        var self = this;
        var preset = $.cookie("preset");
        if (preset) {
            $("#select_script").val(preset);
            $("#select_script").change();
        } else {
            var scriptjson = $.cookie("script");
            if (scriptjson) {
                var script = JSON.parse(scriptjson);        
                self.loadScript(script);
            }
        }
        this._sessionid = $.cookie("sessionid") 
            || new Date().getTime(); 
    },               
});

