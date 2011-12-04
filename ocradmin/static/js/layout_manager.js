

var OcrJs = OcrJs || {};

OcrJs.LayoutManager = OcrJs.Base.extend({
    init: function() {
        this._listeners = {
            initialised: [],
            layoutChanged: [],
        };
    },
});

