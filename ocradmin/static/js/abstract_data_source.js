

var AbstractDataSource = Base.extend({
    constructor: function() {
        this.__sortcol =  0;
        this.__desc = false;
        this.__page =  0;
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
    },

    isPaginated: function() {
        return false;
    },

    page: function() {
        return this.__page;
    },

    setPage : function(page) {
        alert(page);
        this.__page = page;
    },

    nextPage: function() {
        return 1;
    },

    prevPage: function() {
        return -1;
    },

    hasPrev: function() {
        return false;
    },

    hasNext: function() {
        return false;
    },

    numPages: function() {
        return 1;
    },

    sortColumn: function() {
        return this.__sortcol;
    },

    descending: function() {
        return this.__desc;
    },

    setDescending: function() {
        this.__desc = true;
    },

    reverseOrder: function() {
        this.__desc = !this.__desc;
    },

    dataLength: function() {
        return this.__data.length;
    },

    columnCount: function() {
        return this.__headers.length;
    },

    headerLabel: function(col) {
        return this.__headers[col].name;
    },

    data: function() {
        return this.__data;
    },

    getData: function(row, col) {
        return this.__data[row][this.c2d(col)];
    },

    rowMetadata: function(row) {
        return {};
    },

    rowClassNames: function(row) {
        return [];
    },

    cellClassNames: function(row, col) {
        return [];
    },

    cellMetadata: function(row, col) {
        return {};
    },

    rowKey: function(row) {
        return row;
    },

    columnToData: function(col) {
        return col;
    },

    c2d: function(col) {
        return col;
    },

    cellLabel: function(row, col) {
        // check if a specialised renderer exists for the
        // given column.  If not, default to a plain string.
        if (this["renderCellAt" + col] !== undefined)
            return this["renderCellAt" + col](row);
        return this.__data[row][this.c2d(col)].toString();
    },

    getHeaderData: function(col) {
        return this.__headers[col];
    },

    sortByColumn: function(col) {
        if (col == this.__sortcol) {
            this.__desc = !this.__desc;
        } else {
            this.__desc = false;
        }
        this.__sortcol = col;
        this.sort();
    },

    sort: function() {
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
    },

    addListener: function(key, func) {
        if (this.__listeners[key] == undefined)
            throw "Unknown callback: '" + key + "'";
        this.__listeners[key].push(func);
    },

    callListeners: function() {
        var args = Array.prototype.slice.call(arguments);
        var key = args.shift();
        $.each(this.__listeners[key], function(i, func) {
            func.apply(
                func.callee, args.concat(Array.prototype.slice.call(arguments)));
        });
    },

    preSort: function(a, b) {
        return 0;
    },

    numericSort: function(a, b) {
        if (!this.__desc)
            return a - b;
        else
            return b - a;    
    },

    stringSort: function(a, b) {
        if (!this.__desc)
            return a < b ? -1 : 1;
        else
            return b < a ? -1 : 1;
        return 0; 
    },

    booleanSort: function(a, b) {
        //alert(a + " " + b);
        if (a && !b)
            return this.__desc ? 1 : -1;
        else if (b && !a)
            return this.__desc ? -1 : 1;
        else
            return 0;
    },

    // Callbacks

    refreshData: function(params) {
        this.callListeners("dataChanged");
        return this.__data;
    },

    onRefreshStarted: function(params) {
        this.callListeners("startRefresh");
    },

    onRefreshComplete: function(params) {
        this.callListeners("endRefresh");
    },

    onDataChanged: function(params) {
        this.callListeners("dataChanged");
    },

    // Style stuff...

    rowClass: function() {
        return this.__rowclass;
    },

});





var TestDataSource = AbstractDataSource.extend({
    constructor: function() {
        this.__data = [
            ["bibble", 12343, "arse"],
            ["bolly", 3244, "wally"],
        ];
    },

    refreshData: function(params) {
        var self = this;
        return setTimeout(function() {
            self.callListeners("dataChanged");
            return this.__data;
        }, 2000);
    }
});

