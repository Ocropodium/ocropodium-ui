// Data source for file browser widget


var BatchDataSource = AbstractDataSource.extend({
    constructor: function() {
        this.base();    
        this.__data = [];
        this.__url = "/batch/list";
        this.__dir = "";
        this.__headers = [{
                name: "#",
                sortAs: "num",
            }, {
                name: "Name",
                sortAs: "str",
            }, {
                name: "User",
                sortAs: "str",
            }, {
                name: "Type",
                sortAs: "str",
            }, {
                name: "Created",
                sortAs: "str",
            }, {
                name: "Num Tasks",
                sortAs: "bool",
            }, 
        ];

        this.__page = 1;
        this.__sortby = "created_on";
        this.__desc = true;
        this.__sortcol = 2;
        this.__col2sort = {
            0: "pk",
            1: "name",
            2: "user__username",
            3: "task_type",
            4: "created_on",
            5: "task_count",
        };
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
        if (this.__data.object_list[row].fields.is_complete) 
            return [ "complete" ];
        return [];
    },

    cellClassNames: function(row, col) {
        return [];
    },

    cellLabel: function(row, col) {
        if (col == 0)
            return this.__data.object_list[row].pk;
        if (col == 1)
            return this.__data.object_list[row].fields.name;
        if (col == 2)
            return this.__data.object_list[row].extras.username;
        if (col == 3)
            return this.__data.object_list[row].fields.task_type
                .substr(0, this.__data.object_list[row].fields.task_type.indexOf("."));
        if (col == 4)
            return this.__data.object_list[row].fields.created_on;
        if (col == 5)
            return this.__data.object_list[row].extras.task_count;
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
            error: OCRJS.ajaxErrorHandler,
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
        });
    },
});


