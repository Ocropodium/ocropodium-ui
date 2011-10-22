// 
// Size class
//


var DziViewer = DziViewer || {};

DziViewer.Size = function(width, height) {
    this.width = width;
    this.height = height;
}

DziViewer.Size.prototype.clone = function() {
    return new DziViewer.Size(this.width, this.height);
}

DziViewer.Size.prototype.getAspect = function() {
    return this.width / this.height;
}

