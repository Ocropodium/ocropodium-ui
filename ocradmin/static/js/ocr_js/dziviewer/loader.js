// 
// Image loader class.
//

var DziViewer = DziViewer || {};

DziViewer.Loader = OcrJs.Base.extend({
    init: function(options) {
        this._super();
        this.options = {
            delay: null,
        };
        $.extend(this.options, options); 

        this._waiting = 0;

        this._listeners = {
            loadedImage: [],
            loadedAll: [],
        };
    },
    
    loadImage: function(path, callback) {                    
        var self = this;    

        var img = new Image();
        img.onload = function(e) {
            if (self.options.delay) {
                setTimeout(function() {
                    callback(path, img);
                }, self.options.delay);
            } else {
                callback(path, img);
            }
        };
        img.src = path;
    },

    loadImages: function(paths_callbacks) {
        var self = this;
        this._waiting = paths_callbacks.length;
        if (this._waiting == 0) {
            this.trigger("loadedAll");
            return;
        }


        $.each(paths_callbacks, function(i, obj) {
            var img = new Image();
            img.onload = function(e) {
                setTimeout(function() {
                    obj.callback.call(this, obj.path, img);
                    self._waiting--;
                    self.trigger("loadedImage", img, obj.path);
                    if (self._waiting == 0)
                        self.trigger("loadedAll");
                }, self.options.delay);                    
            }
            img.src = obj.path;
        });
    },                    
});    
