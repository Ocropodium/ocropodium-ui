// Data source for file browser widget.  Uses Dean Edward's Base.js utils for 
// inheritance.


var TaskDataSource = AbstractDataSource.extend({
    constructor: function() {
        this.base();
        this.__data = [];
        this.__url = "/ocrtasks/list";
        this.__dir = "";
        this.__headers = [{
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

        this.__page = 1;
        this.__sortby = "updated_on";
        this.__desc = true;
        this.__sortcol = 2;
        this.__col2sort = {
            0: "pk",
            1: "page_name",
            2: "user__username",
            3: "updated_on",
            4: "status",
        }
    },



    isPaginated: function() {
        return this.__data.has_other_pages;
    },

    page: function() {
        return this.__page;
    },

    setPage : function(page) {
        this.__page = page;
        this.refreshData();
    },

    nextPage: function() {
        return this.__data.next_page_number;
    },

    prevPage: function() {
        return this.__data.previous_page_number;
    },

    hasPrev: function() {
        return this.__data.has_previous;
    },

    hasNext: function() {
        return this.__data.has_next;
    },

    numPages: function() {
        return this.__data.num_pages;
    },

    url: function() {
        return this.__url;
    },

    dataLength: function() {
        return this.__data.object_list.length;
    },

    rowMetadata: function(row) {
        return {
            pk: this.__data.object_list[row].pk,
        };
    },

    rowClassNames: function(row) {
        return [
            this.__data.object_list[row].fields.status.toLowerCase(),
        ];
    },

    cellClassNames: function(row, col) {
        return [];
    },

    cellLabel: function(row, col) {
        if (col == 0)
            return this.__data.object_list[row].pk;
        if (col == 1)
            return this.__data.object_list[row].fields.page_name;
        if (col == 2)
            return this.__data.object_list[row].fields.user.fields.username;
        if (col == 3)
            return this.__data.object_list[row].fields.updated_on;
        if (col == 4)
            return this.__data.object_list[row].fields.status;
    },


    sortByColumn: function(col) {
        var s = this.__col2sort[col];
        if (this.__sortby == s)
            this.__desc = !this.__desc;
        else
            this.__sortby = s;
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
            url: self.__url,
            dataType: "json",
            data: {
                page: self.__page,
                order_by: self.__desc ? "-" + self.__sortby : self.__sortby,
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
                self.__data = data;
                self.callListeners("dataChanged");
            },
            error: function(xhr, error) {
                alert(error);
            },
        });
    },
});

