// 
// Rect class
//

var DziViewer = DziViewer || {};

DziViewer.Rect = function(d0, d1, d2, d3) {
    /*
    Rectangle class, Iulib-style.
    */

    if (arguments.length == 4) {
        this.x0 = d0;
        this.y0 = d1;
        this.x1 = d2;
        this.y1 = d3;
    } else if (arguments.length == 2) {
        this.x0 = d0.x;
        this.y0 = d0.y;
        this.x1 = d1.x;
        this.y1 = d1.y;    
    } else 
        console.assert("Invalid arguments given to Rect", arguments);

}


DziViewer.Rect.prototype.__defineGetter__("x", function() {
    return Math.min(this.x0, this.x1);
});

DziViewer.Rect.prototype.__defineGetter__("y", function() {
    return Math.min(this.y0, this.y1);
});

DziViewer.Rect.prototype.__defineSetter__("x", function(val) {
    this.x1 = val + this.width;
    this.x0 = val;
});

DziViewer.Rect.prototype.__defineSetter__("y", function(val) {
    this.y1 = val + this.height;
    this.y0 = val;
});

DziViewer.Rect.prototype.__defineGetter__("width", function() {
    return Math.max(0, this.x1 - this.x0);
});

DziViewer.Rect.prototype.__defineGetter__("height", function() {
    return Math.max(0, this.y1 - this.y0);
});

DziViewer.Rect.prototype.toString = function() {
    return "<Rect: " + this.x0 + ", " + this.y0 + ", " + this.x1 + ", " + this.y1 + ">";
}

DziViewer.Rect.prototype.isSameAs = function(other) {
    return this.x0 == other.x0 && this.y0 == other.y0
            && this.x1 == other.x1 && this.y1 == other.y1;    
}

DziViewer.Rect.prototype.dilate = function(amount) {
    return new DziViewer.Rect(
            this.x0 - amount,
            this.y0 - amount,
            this.x1 + amount,
            this.y1 + amount
    );            
}    

DziViewer.Rect.prototype.aspect = function() {
    if (this.empty())
        return 1;
    return this.width / this.height;
}

DziViewer.Rect.prototype.area = function() {
    if (this.empty())
        return 0;
    return this.width * this.height;
}

DziViewer.Rect.prototype.clone = function() {
    return new DziViewer.Rect(this.x0, this.y0, this.x1, this.y1);
}

DziViewer.Rect.prototype.empty = function() {
    return this.x0 >= this.x1 && this.y0 >= this.y1;
}

DziViewer.Rect.prototype.padBy = function(p) {
    console.assert(!this.empty(), "Attempting to pad an empty Rect")
    return new DziViewer.Rect(
            this.x0 - p.x,
            this.y0 - p.y,
            this.x1 + p.x,
            this.y1 + p.y
    );
}

DziViewer.Rect.prototype.shiftBy = function(p) {
    console.assert(!this.empty(), "Attempting to shift an empty Rect");
    return new DziViewer.Rect(
            this.x0 + p.x,
            this.y0 + p.y,
            this.x1 + p.x,
            this.y1 + p.y
    );
}

DziViewer.Rect.prototype.adjust = function(factor) {
    return new DziViewer.Rect(
            this.x0 * factor,
            this.y0 * factor,
            this.x1 * factor,
            this.y1 * factor
    );
}    

DziViewer.Rect.prototype.grow = function(dx, dy) {
    return new DziViewer.Rect(this.x0 - dx, this.y0 - dy, 
            this.x1 + dx, this.y1 + dy);
}            

DziViewer.Rect.prototype.overlaps = function(rect) {
    return this.x0 <= rect.x1 && this.x1 >= rect.x0
            && this.y0 <= rect.y1 && this.y1 >= rect.y0;
}                

DziViewer.Rect.prototype.overlapsX = function(rect) {
    return this.x0 <= rect.x1 && this.x1 >= rect.x0;
}            

DziViewer.Rect.prototype.overlapsY = function(rect) {
    return this.y0 <= rect.y1 && this.y1 >= rect.y0;
}            

DziViewer.Rect.prototype.contains = function(p) {
    return p.x >= this.x0 && p.x < this.x1 
            && p.y >= this.y0 && p.y < this.y1;
}                

DziViewer.Rect.prototype.points = function() {
    return [this.x0, this.y0, this.x1, this.y1,];
}           

DziViewer.Rect.prototype.intersection = function(rect) {
    if (this.empty())
        return this;
    return DziViewer.Rect(
            Math.max(this.x0, rect.x0),
            Math.max(this.y0, rect.y0),
            Math.min(this.x1, rect.x1),
            Math.min(this.y1, rect.y1)
    );                
}            

DziViewer.Rect.prototype.inclusion = function(rect) {
    if (this.empty())
        return rect;
    return new DziViewer.Rect(
            Math.min(this.x0, rect.x0),
            Math.min(this.y0, rect.y0),
            Math.max(this.x1, rect.x1),
            Math.max(this.y1, rect.y1)
    ); 
}          

DziViewer.Rect.prototype.fractionCoveredBy = function(rect) {
    var isect = this.intersection(rect)
    if (this.area())
        return isect.area() / float(this.area());
    else
        return -1;
}            

DziViewer.Rect.prototype.unionOf = function() {
    var r = new DziViewer.Rect(0, 0, 0, 0)
    for (arg in arguments)
        r.include(arguments[arg]);
    return r;            
}

DziViewer.Rect.prototype.normalize = function() {
    return new DziViewer.Rect(
        Math.min(this.x0, this.x1),
        Math.min(this.y0, this.y1),
        Math.max(this.x0, this.x1),
        Math.max(this.y0, this.y1)
    );
}

DziViewer.Rect.prototype.topLeft = function() {
    return new DziViewer.Point(this.x0, this.y0);
}

DziViewer.Rect.prototype.bottomRight = function() {
    return new DziViewer.Point(this.x1, this.y1);
}

DziViewer.Rect.prototype.getSize = function() {
    return new DziViewer.Size(this.width, this.height);
}

