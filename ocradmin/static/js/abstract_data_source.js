

var AbstractDataSource = OcrJs.Base.extend({
    init: function() {
        this._sortcol =  0;
        this._desc = false;
        this._page =  0;
        this._rowclass = "abstract_entry";

        this._listeners = {
            startRefresh: [],
            dataChanged: [],
            endRefresh: [],
        };

        this._headers = [{
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

        this._data = [
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
        return this._page;
    },

    setPage : function(page) {
        alert(page);
        this._page = page;
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
        return this._sortcol;
    },

    descending: function() {
        return this._desc;
    },

    setDescending: function() {
        this._desc = true;
    },

    reverseOrder: function() {
        this._desc = !this._desc;
    },

    dataLength: function() {
        return this._data.length;
    },

    columnCount: function() {
        return this._headers.length;
    },

    headerLabel: function(col) {
        return this._headers[col].name;
    },

    data: function() {
        return this._data;
    },

    getData: function(row, col) {
        return this._data[row][this.c2d(col)];
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
        return this._data[row][this.c2d(col)].toString();
    },

    getHeaderData: function(col) {
        return this._headers[col];
    },

    sortByColumn: function(col) {
        if (col == this._sortcol) {
            this._desc = !this._desc;
        } else {
            this._desc = false;
        }
        this._sortcol = col;
        this.sort();
    },

    sort: function() {
        var col = this._sortcol;
        var self = this;
        self._data.sort(function(a, b) {
            var ps = self.preSort(a, b);
            if (ps != 0)
                return ps;
            if (self._headers[col].sortAs == "bool")
                return self.booleanSort(a[self.c2d(col)], b[self.c2d(col)])
            if (self._headers[col].sortAs == "num")
                return self.numericSort(parseFloat(a[self.c2d(col)]), parseFloat(b[self.c2d(col)]))
            if (self._headers[col].sortAs == "str")
                return self.stringSort(a[self.c2d(col)], b[self.c2d(col)])
            if (typeof self._headers[col].sortAs == "function")
                return self._headers[col].sortAs(a[self.c2d(col)], b[self.c2d(col)]);
        });
        self.trigger("dataChanged");        
    },

    preSort: function(a, b) {
        return 0;
    },

    numericSort: function(a, b) {
        if (!this._desc)
            return a - b;
        else
            return b - a;    
    },

    stringSort: function(a, b) {
        if (!this._desc)
            return a < b ? -1 : 1;
        else
            return b < a ? -1 : 1;
        return 0; 
    },

    booleanSort: function(a, b) {
        //alert(a + " " + b);
        if (a && !b)
            return this._desc ? 1 : -1;
        else if (b && !a)
            return this._desc ? -1 : 1;
        else
            return 0;
    },

    // Callbacks

    refreshData: function(params) {
        this.trigger("dataChanged");
        return this._data;
    },

    onRefreshStarted: function(params) {
        this.trigger("startRefresh");
    },

    onRefreshComplete: function(params) {
        this.trigger("endRefresh");
    },

    onDataChanged: function(params) {
        this.trigger("dataChanged");
    },

    // Style stuff...

    rowClass: function() {
        return this._rowclass;
    },

});





var TestDataSource = AbstractDataSource.extend({
    init: function() {
        this._data = [
            ["bibble", 12343, "arse"],
            ["bolly", 3244, "wally"],
        ];
    },

    refreshData: function(params) {
        var self = this;
        return setTimeout(function() {
            self.trigger("dataChanged");
            return this._data;
        }, 2000);
    }
});

