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
    },

    hasCurrent: function() {
        return Boolean(this._current);
    },        

    updateGui: function() {
        if (this._current && this._currentgui)
            this._currentgui.update();
    },                   

    refreshGui: function() {
        if (this._current && this._currentgui) {
            this._currentgui.refresh();
        } else {
            this.tearDownGui();
        }
    },                    

    setupGui: function(node) {
        var self = this;
        if (this._current && this._current != node)
            this.tearDownGui();            
        this._current = node;

        var type = node.type.replace(/^[^\.]+\./, "") + "Gui";
        var klass = OCRJS.NodeGui[type];
        if (klass) {
            this._currentgui = new klass(this._viewer.viewport, node);
            this._viewer.addOverlayPlugin(this._currentgui);
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
            this._currentgui.refresh();
        } else {
            console.log("No current node", node.type, this._types);
        }        
    },                  

    tearDownGui: function() {                     
        if (this._currentgui) {
            console.log("tear down gui");
            this._viewer.removeOverlayPlugin(this._currentgui);
            this._currentgui.removeListeners(".nodegui");
            this.callListeners("tearDownGui");
            this._currentgui = null;
            this._current = null;
        }
    },
});
