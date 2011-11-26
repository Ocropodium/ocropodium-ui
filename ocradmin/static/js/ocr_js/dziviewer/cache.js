//
// Cache for image data
//

var DziViewer = DziViewer || {};

DziViewer.ImageCache = function() {
    this._pathcache = [];
}

DziViewer.ImageCache.prototype.get = function(level, path) {
    if (this._pathcache[level])
        return this._pathcache[level][path];
}

DziViewer.ImageCache.prototype.set = function(level, path, image) {
    if (!this._pathcache[level])
        this._pathcache[level] = {};
    this._pathcache[level][path] = image;
}
