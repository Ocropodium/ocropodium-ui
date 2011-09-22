// 
// Class to handle GUIs for nodes.
//

var OCRJS = OCRJS || {};
OCRJS.Nodetree = OCRJS.Nodetree || {};


OCRJS.Nodetree.GuiManager = OCRJS.OcrBase.extend({
    constructor: function(viewer) {
        this.base();
        this._viewer = viewer;
        this._types = {};
        this._current = null;

        this._listeners = {
            setupGui: [],
            tearDownGui: [],
            parametersSet: [],
            interacting: [],
        };
        this.registerGuis();
    },

    hasCurrent: function() {
        return Boolean(this._current);
    },        

    registerGuis: function() {
        var self = this;                      
        if (!OCRJS.NodeGui)
            throw "No gui container namespace found."

        $.each(OCRJS.NodeGui, function(name, klass) {
            var obj = new klass(self._viewer);
            if (obj.nodeclass) {
                console.log("Registering", obj.nodeclass);
                self._types[obj.nodeclass] = obj;
            } else {
                obj = null;
            }
        });
    },

    updateGui: function() {
        if (this._current && this._currentgui)
            this._currentgui.update();
    },                   

    refreshGui: function() {
        if (this._current && this._currentgui) {
            this._currentgui.tearDown();
            this._currentgui.setup(this._current);
        } else {
            this.tearDownGui();
        }
    },                    

    setupGui: function(node) {
        var self = this;
        if (this._current && this._current != node)
            this.tearDownGui();            
        this._current = node;
        this._currentgui = this._types[node.type];
        if (this._currentgui) {
            this._currentgui.setup(node);
            this._currentgui.addListener("parametersSet.nodegui", function(n, pd) {                
                self.callListeners("parametersSet", n, pd); 
            });
            this._currentgui.addListener("interactingStart.nodegui", function() {
                self.callListeners("interacting", true); 
            });
            this._currentgui.addListener("interactingStop.nodegui", function() {
                self.callListeners("interacting", false); 
            });
            this.callListeners("setupGui");
        } else {
            console.log("No current node", node.type, this._types);
        }        
    },                  

    tearDownGui: function() {
        if (this._currentgui) {
            this._currentgui.tearDown();
            this._currentgui.removeListeners(".nodegui");
            this.callListeners("tearDownGui");
            this._currentgui = null;
            this._current = null;
        }
    },
});
