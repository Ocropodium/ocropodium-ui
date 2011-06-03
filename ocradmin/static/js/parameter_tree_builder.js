//
// Fancy pants parameter tree.
//

var OCRJS = OCRJS || {}

OCRJS.NodeTree = OCRJS.OcrBase.extend({
    constructor: function(parent, options) {
        this.base(parent, options);

        this.parent = parent;

    },


    init: function() {
        console.log("Initialised...");
    },


});
