// Data source for file browser widget.  Uses Dean Edward's Base.js utils for 
// inheritance.


var TaskDataSource = AbstractDataSource.extend({
    constructor: function() {
        this.base();
        this._data = [];
        this._url = "/ocrtasks/list";
        this._dir = "";
        this._headers = [{
                name: "#",
                sortAs: "num",
            }, {
                name: "Page File",
                sortAs: "str",
            }, {
                name: "User",
                sortAs: "str",
            }, {
                name: "Last Updated",
                sortAs: "str",
            }, {
                name: "Status",
                sortAs: "str",
            }, 
        ];

        this._page = 1;
        this._sortby = "updated_on";
        this._desc = true;
        this._sortcol = 2;
        this._col2sort = {
            0: "pk",
            1: "page_name",
            2: "user",
            3: "updated_on",
            4: "status",
        }
    },



    isPaginated: function() {
        return this._data.has_other_pages;
    },

    page: function() {
        return this._page;
    },

    setPage : function(page) {
        this._page = page;
        this.refreshData();
    },

    nextPage: function() {
        return this._data.next_page_number;
    },

    prevPage: function() {
        return this._data.previous_page_number;
    },

    hasPrev: function() {
        return this._data.has_previous;
    },

    hasNext: function() {
        return this._data.has_next;
    },

    numPages: function() {
        return this._data.num_pages;
    },

    url: function() {
        return this._url;
    },

    dataLength: function() {
        return this._data.object_list.length;
    },

    rowMetadata: function(row) {
        return {
            pk: this._data.object_list[row].pk,
        };
    },

    rowClassNames: function(row) {
        return [
            this._data.object_list[row].extras.status.toLowerCase(),
        ];
    },

    cellClassNames: function(row, col) {
        return [];
    },

    cellLabel: function(row, col) {
        if (col == 0)
            return this._data.object_list[row].pk;
        if (col == 1)
            return this._data.object_list[row].fields.page_name;
        if (col == 2)
            return this._data.object_list[row].extras.user;
        if (col == 3)
            return this._data.object_list[row].extras.updated_on;
        if (col == 4)
            return this._data.object_list[row].extras.status;
    },


    sortByColumn: function(col) {
        var s = this._col2sort[col];
        if (this._sortby == s)
            this._desc = !this._desc;
        else
            this._sortby = s;
        this.refreshData();
    },

    preSort: function(a, b) {
        return 0;
    },

    c2d: function(col) {
        return col;
    },

    refreshData: function(params) {
        var self = this;
        $.ajax({
            url: self._url,
            dataType: "json",
            data: {
                page: self._page,
                order_by: self._desc ? "-" + self._sortby : self._sortby,
            },
            beforeSend: function(e) {
                self.callListeners("startRefresh");
            },
            complete: function(e) {
                self.callListeners("endRefresh");
            },
            success: function(data) {
                if (data.error) {
                    alert("Error: " + data.error);
                    return;
                }
                self._data = data;
                self.callListeners("dataChanged");
            },
            error: OCRJS.ajaxErrorHandler,
        });
    },
});

