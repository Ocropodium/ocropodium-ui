//
// Point class
//


var DziViewer = DziViewer || {};

DziViewer.Point = function(x, y) {
    this.x = x;
    this.y = y;
}

DziViewer.Point.prototype.clone = function() {
    return new DziViewer.Point(this.x, this.y);
}

DziViewer.Point.prototype.shiftBy = function(p) {
    return new DziViewer.Point(
            this.x + p.x,
            this.y + p.y
    );
}
