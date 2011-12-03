//
// Class to handle GUIs for nodes.
//

var OcrJs = OcrJs || {};
OcrJs.Nodetree = OcrJs.Nodetree || {};


OcrJs.Nodetree.GuiManager = OcrJs.Base.extend({
    init: function(viewer) {
        this._super();
        this._viewer = viewer;
        this._node = null;
        this._gui = null;

        this._listeners = {
            setupGui: [],
            tearDownGui: [],
            parametersSet: [],
            interacting: [],
        };
    },

    hasCurrent: function() {
        return this._node !== null;
    },

    currentGui: function() {
        return this._gui;
    },

    currentNode: function() {
        return this._node;
    },

    updateGui: function() {
        if (this._node && this._gui)
            this._gui.update();
    },

    refreshGui: function() {
        if (this._node && this._gui) {
            this._gui.refresh();
        } else {
            this.tearDownGui();
        }
    },

    setupGui: function(node) {
        var self = this;

        this.tearDownGui();

        // GUI classes should be named with the unqualified type of the
        // node plus 'Gui', i.e. pil.PilCrop -> PilCropGui
        var type = node.type.replace(/^[^\.]+\./, "") + "Gui";
        var klass = OcrJs.NodeGui[type];
        if (klass) {
            this._node = node;
            this._gui = new klass(this._viewer.viewport, node);
            this._viewer.addOverlayPlugin(this._gui);
            this._gui.addListeners({
                parametersSet: function(n, pd) {
                    self.trigger("parametersSet", n, pd);
                },
                interactingStart: function() {
                    self.trigger("interacting", true);
                },
                interactingStop: function() {
                    self.trigger("interacting", false);
                },
            });
            this._gui.refresh();
            this.trigger("setupGui");
        }
    },

    tearDownGui: function() {
        if (this._gui)
            this._viewer.removeOverlayPlugin(this._gui)
        this._gui = this._node = null;
        this.trigger("tearDownGui");
    },
});
