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
        };
        this.registerGuis();
    },              

    registerGuis: function() {
        var self = this;                      
        if (!OCRJS.NodeGui)
            throw "No gui container namespace found."

        $.each(OCRJS.NodeGui, function(name, klass) {
            if (klass.nodeclass)
                self._types[klass.nodeclass] = new klass(self._viewer);
        });
    },

    setupGui: function(node) {
        this._current = this._types[node.type];
        if (this._current) {
            this._current.setup();
            this.callListeners("setupGui");
        }        
    },                  

    tearDownGui: function() {
        if (this._current) {
            this._current.tearDown();
            this.callListeners("tearDownGui");
            this._current = null;
        }
    },
});
