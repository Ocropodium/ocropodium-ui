// 
// Imageviewer tilesource.  This class is pretty much
// a straight port of the DeepZoomDescriptor class in
// deepzoom.py
//

var DziViewer = DziViewer || {};

DziViewer.TileSource = OcrJs.Base.extend({
    init: function(path, xml) {
        this._super();

        console.log("Loading", xml);
        

        this._tilebase = path.replace(/\.dzi$/, "_files")
        this.format = xml.find("Image").attr("Format");
        this.tilesize = parseInt(xml.find("Image").attr("TileSize"));
        this.overlap = parseInt(xml.find("Image").attr("Overlap"));
        this.width = parseInt(xml.find("Size").attr("Width"));
        this.height = parseInt(xml.find("Size").attr("Height"));

        // values we cache between calls
        this._numlevels = null;
        this._enumerate = [];

        this._listeners = {
            loaded: [],
        };

    },
        
    numLevels: function() {
        /* Number of levels in the pyramid.*/
        if (this._numlevels === null) {
            var max_dimension = Math.max(this.width, this.height);
            this._numlevels = parseInt(Math.ceil(Math.log(max_dimension) / Math.log(2))) + 1;
        }
        return this._numlevels;
    },

    enumerate: function(level) {
        // function to calculate (and cache) the individual
        // row/column pairs at each level
        if (this._enumerate[level] && this._enumerate[level].length)
            return this._enumerate[level];

        var colrows = this.getNumTiles(level),
            columns = colrows[0],
            rows = colrows[1]; 
        this._enumerate[level] = [];
        for (var i = 0; i < columns; i++) {
            for (var j = 0; j < rows; j++)
                this._enumerate[level].push([i, j]);
        }
        return this._enumerate[level];
    },                   

    load: function(path, xmldata) {
    },

    toString: function() {
        return "<TileSource: " + this.format 
                + " (" + this.tilesize + ") "
                + this.width + "x" + this.height + ">";
    },

    getPath: function(level, col, row) {
        return [this._tilebase, "/", level, "/", col, "_", row, ".", this.format].join("");
    },                 

    getScale: function(level) {
        /* Scale of a pyramid level. */
        this._checkLevel(level);
        var max_level = this.numLevels() - 1;
        return Math.pow(0.5, max_level - level);
    },

    getNearestLevel: function(scale) {
        var max_level = this.numLevels() - 1;                         
        return Math.min(max_level, max_level - Math.floor(Math.log(scale) / Math.log(0.5)));
    },

    getAdjustmentFactor: function(scale, level) {
        // calculate the difference factor to convert an image at
        // the given scale, to one at the given level
        // i.e. if scale 1/1 is level 13, and given scale 8
        // the factor would be 0.125                              
        return scale / this.getScale(level);
    },                       

    getDimensions: function(level) {
        /* Dimensions of level (width, height) */
        this._checkLevel(level);
        var scale = this.getScale(level);
        return new DziViewer.Size(
            Math.ceil(this.width * scale),
            Math.ceil(this.height * scale)
        );
    },

    getAspect: function() {
        return this.width / this.height;
    },                   

    getLevelToFit: function(width, height) {
        var aspect = width / height;        
        var scale = aspect > this.getAspect() 
                ? height / this.height
                : width / this.width;
        if (scale > 1)
            return this.numLevels() - 1;
        return this.getNearestLevel(scale);
    },

    getScaleToFit: function(width, height) {
        var aspect = width / height;        
        return aspect > this.getAspect() 
                ? height / this.height
                : width / this.width;
    },                       

    getNumTiles: function(level) {
        /* Number of tiles (columns, rows) */
        this._checkLevel(level);
        var dims = this.getDimensions(level);
        return [Math.ceil(dims.width / this.tilesize),
                Math.ceil(dims.height / this.tilesize)];
    },    

    getTileBounds: function(level, column, row) {
        /* Bounding box of the tile (x1, y1, x2, y2) */
        console.assert(0 <= level && level < this.numLevels(), "Invalid pyramid level");
        var offset_x = column == 0 ? 0 : this.overlap,
            offset_y = row    == 0 ? 0 : this.overlap,
            x0 = (column * this.tilesize) - offset_x,
            y0 = (row    * this.tilesize) - offset_y;

        var level_dims = this.getDimensions(level),
            x1 = x0 + (this.tilesize + (column == 0 ? 1 : 2) * this.overlap),
            y1 = y0 + (this.tilesize + (row    == 0 ? 1 : 2) * this.overlap),
            x1 = Math.min(x1, level_dims.width),
            y1 = Math.min(y1, level_dims.height);
        return new DziViewer.Rect(x0, y0, x1, y1);
    },

    getSize: function() {
        return new DziViewer.Size(this.width, this.height);
    },

    _checkLevel: function(level) {
        if (level < 0 && level >= this.numLevels())
            throw "Invalid level " + level + " NumLevels: " + this.numLevels();
    },                     
});

