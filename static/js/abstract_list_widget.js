

function AbstractDataSource() {
    this.__sortcol = 0;
    this.__desc = false;

    this.__listeners = {
        startRefresh: [],
        dataChanged: [],
        endRefresh: [],
    };

    this.__headers = [{
            name: "Col1",
            sortAs: String,
        }, {
            name: "Col2",
            sortAs: Number,
        }, {
            name: "Col3",
            sortAs: Boolean,
        }, {
            name: "Col4",
            sortAs: String,
        }, 
    ];

    this.__data = [
        ["data0", 0, true, "a"],
        ["data1", 1, false, "b"],        
        ["data2", 2, true, "c"],
        ["data3", 3, false, "d"],
        ["data4", 4, true, "e"],
        ["data5", 5, false, "f"],
        ["data6", 6, true, "g"],
        ["data7", 7, false, "h"],
        ["data8", 8, true, "i"],
        ["data9", 9, false, "j"],
        ["data10", 10, true, "k"],
    ];
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
    return self.__data.length;
}

AbstractDataSource.prototype.data = function() {
    return self.__data;
}

AbstractDataSource.prototype.getData = function(row, col) {
    return this.__data[row][col];
}

AbstractDataSource.prototype.getHeaderData = function(col) {
    return self.__headers[col];
}

AbstractDataSource.prototype.sortByColumn = function(col) {
    if (col == this.__sortcol)
        this.__desc = !this.__desc;
    var self = this;
    self.__data.sort(function(a, b) {
        if (self.__headers[col].sortBy === Boolean)
            return this.booleanSort(a, b)
        if (self.__headers[col].sortBy === Number)
            return this.numericSort(a, b)
        if (self.__headers[col].sortBy === String)
            return this.stringSort(a, b)
        if (typeof self.__headers[col].sortBy == "function")
            return self.__headers[col].sortBy(a, b);
    });
    self.callListeners("dataChanged");        
}

AbstractDataSource.prototype.addListener = function(key, func) {
    if (this.__listeners[key] == undefined)
        throw "Unknown callback: '" + key + "'";
    this.__listeners[key].push(func);
}

AbstractDataSource.prototype.callListeners = function(key) {
    $.each(this.__listeners[key], function(i, func) {
        func.apply(func.callee);
    });
}

AbstractDataSource.prototype.numericSort = function(a, b) {
    if (!this.__desc)
        return a[this.__sortcol] - b[this.__sortcol];
    else
        return b[this.__sortcol] - a[this.__sortcol];    
}

AbstractDataSource.prototype.stringSort = function(a, b) {
    if (!this.__desc)
        return a[this.__sortcol] > b[this.__sortcol] ? -1 : 1;
    else
        return b[this.__sortcol] > a[this.__sortcol] ? -1 : 1; 
}

AbstractDataSource.prototype.booleanSort = function(a, b) {
    if (a[this.__sortcol] && !b[this.__sortcol])
        return this.__desc ? 1 : -1;
    else if (b[this.__sortcol] && !a[this.__sortcol])
        return this.__desc ? -1 : 1;
    else
        return 0;
}

AbstractDataSource.prototype.refreshData = function(params) {
    return this.__data;
    this.callListeners("dataChanged");
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


