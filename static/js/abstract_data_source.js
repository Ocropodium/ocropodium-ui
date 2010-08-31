

function AbstractDataSource() {
    this.__sortcol = 0;
    this.__desc = false;
    this.__page = 0;
    this.__rowclass = "abstract_entry";

    this.__listeners = {
        startRefresh: [],
        dataChanged: [],
        endRefresh: [],
    };

    this.__headers = [{
            name: "Col1",
            sortAs: "num",
        }, {
            name: "Col2",
            sortAs: "str",
        }, {
            name: "Col3",
            sortAs: "bool",
        }, {
            name: "Col4",
            sortAs: "str",
        }, 
    ];

    this.__data = [
        [0, "data0", true,  "a"],
        [1, "data1", false, "b"],        
        [2, "data2", true,  "c"],
        [3, "data3", false, "d"],
        [4, "data4", true,  "e"],
        [5, "data5", false, "f"],
        [6, "data6", true,  "g"],
        [7, "data7", false, "h"],
        [8, "data8", true,  "i"],
        [9, "data9", false, "j"],
        [10,"data10",true,  "k"],
    ];
}

AbstractDataSource.prototype.isPaginated = function() {
    return false;
}

AbstractDataSource.prototype.page = function() {
    return this.__page;
}

AbstractDataSource.prototype.setPage  = function(page) {
    this.__page = page;
}

AbstractDataSource.prototype.nextPage = function() {
    return 1;
}

AbstractDataSource.prototype.prevPage = function() {
    return -1;
}

AbstractDataSource.prototype.hasPrev = function() {
    return false;
}

AbstractDataSource.prototype.hasNext = function() {
    return false;
}

AbstractDataSource.prototype.numPages = function() {
    return 1;
}

AbstractDataSource.prototype.sortColumn = function() {
    return this.__sortcol;
}

AbstractDataSource.prototype.descending = function() {
    return this.__desc;
}

AbstractDataSource.prototype.setDescending = function() {
    this.__desc = true;
}

AbstractDataSource.prototype.reverseOrder = function() {
    this.__desc = !this.__desc;
}

AbstractDataSource.prototype.dataLength = function() {
    return this.__data.length;
}

AbstractDataSource.prototype.columnCount = function() {
    return this.__headers.length;
}

AbstractDataSource.prototype.headerLabel = function(col) {
    return this.__headers[col].name;
}

AbstractDataSource.prototype.data = function() {
    return this.__data;
}

AbstractDataSource.prototype.getData = function(row, col) {
    return this.__data[row][this.c2d(col)];
}

AbstractDataSource.prototype.rowMetadata = function(row) {
    return {};
}

AbstractDataSource.prototype.rowClassNames = function(row) {
    return [];
}

AbstractDataSource.prototype.cellClassNames = function(row, col) {
    return [];
}

AbstractDataSource.prototype.cellMetadata = function(row, col) {
    return {};
}

AbstractDataSource.prototype.rowKey = function(row) {
    return this.__data[row][0];
}

AbstractDataSource.prototype.columnToData = function(col) {
    return col;
}

AbstractDataSource.prototype.c2d = AbstractDataSource.prototype.columnToData;

AbstractDataSource.prototype.cellLabel = function(row, col) {
    // check if a specialised renderer exists for the
    // given column.  If not, default to a plain string.
    if (this["renderCellAt" + col] !== undefined)
        return this["renderCellAt" + col](row);
    return this.__data[row][this.c2d(col)].toString();
}

AbstractDataSource.prototype.getHeaderData = function(col) {
    return this.__headers[col];
}

AbstractDataSource.prototype.sortByColumn = function(col) {
    if (col == this.__sortcol) {
        this.__desc = !this.__desc;
    } else {
        this.__desc = false;
    }
    this.__sortcol = col;
    this.sort();
}

AbstractDataSource.prototype.sort = function() {
    var col = this.__sortcol;
    var self = this;
    self.__data.sort(function(a, b) {
        var ps = self.preSort(a, b);
        if (ps != 0)
            return ps;
        if (self.__headers[col].sortAs == "bool")
            return self.booleanSort(a[self.c2d(col)], b[self.c2d(col)])
        if (self.__headers[col].sortAs == "num")
            return self.numericSort(parseFloat(a[self.c2d(col)]), parseFloat(b[self.c2d(col)]))
        if (self.__headers[col].sortAs == "str")
            return self.stringSort(a[self.c2d(col)], b[self.c2d(col)])
        if (typeof self.__headers[col].sortAs == "function")
            return self.__headers[col].sortAs(a[self.c2d(col)], b[self.c2d(col)]);
    });
    self.callListeners("dataChanged");        
}

AbstractDataSource.prototype.addListener = function(key, func) {
    if (this.__listeners[key] == undefined)
        throw "Unknown callback: '" + key + "'";
    this.__listeners[key].push(func);
}

AbstractDataSource.prototype.callListeners = function() {
    var args = Array.prototype.slice.call(arguments);
    var key = args.shift();
    $.each(this.__listeners[key], function(i, func) {
        func.apply(func.callee, args.concat(Array.prototype.slice.call(arguments)));
    });
}

AbstractDataSource.prototype.preSort = function(a, b) {
    return 0;
}

AbstractDataSource.prototype.numericSort = function(a, b) {
    if (!this.__desc)
        return a - b;
    else
        return b - a;    
}

AbstractDataSource.prototype.stringSort = function(a, b) {
    if (!this.__desc)
        return a < b ? -1 : 1;
    else
        return b < a ? -1 : 1;
    return 0; 
}

AbstractDataSource.prototype.booleanSort = function(a, b) {
    //alert(a + " " + b);
    if (a && !b)
        return this.__desc ? 1 : -1;
    else if (b && !a)
        return this.__desc ? -1 : 1;
    else
        return 0;
}

// Callbacks

AbstractDataSource.prototype.refreshData = function(params) {
    this.callListeners("dataChanged");
    return this.__data;
}

AbstractDataSource.prototype.onRefreshStarted = function(params) {
    this.callListeners("startRefresh");
}

AbstractDataSource.prototype.onRefreshComplete = function(params) {
    this.callListeners("endRefresh");
}

AbstractDataSource.prototype.onDataChanged = function(params) {
    this.callListeners("dataChanged");
}

// Style stuff...

AbstractDataSource.prototype.rowClass = function() {
    return this.__rowclass;
}


TestDataSource.prototype = new AbstractDataSource();
TestDataSource.prototype.constructor = TestDataSource;
function TestDataSource() {
    var self = this;
    this.__data = [
        ["bibble", 12343, "arse"],
        ["bolly", 3244, "wally"],
    ];

    this.refreshData = function(params) {
        return setTimeout(function() {
            self.callListeners("dataChanged");
            return this.__data;
        }, 2000);
    }
}


