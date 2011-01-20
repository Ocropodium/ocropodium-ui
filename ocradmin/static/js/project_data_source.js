// Data source for project list widget

var ProjectDataSource = AbstractDataSource.extend({
    constructor: function() {
        this.base();
        this.__data = [];
        this.__headers = [{
                name: "Name",
                sortAs: "str",
            }, {
                name: "Date",
                sortAs: "str",
            }, {
                name: "Description",
                sortAs: "str",
            },
        ];

        this.__sortby = "created_on";
        this.__desc = true;
        this.__sortcol = 1;
        this.__col2sort = {
            0: "name",
            1: "created_on",
            2: "description",
        }
    },

    params: function() {
        return {
            order_by: this.__desc 
                ? "-" + this.__sortby 
                : this.__sortby,
        };
    },

    dataLength: function() {
        return this.__data.length;
    },

    rowKey: function(row) {
        return this.__data[row].pk;
    },

    rowMetadata: function(row) {
        return {
            pk: this.__data[row].pk,
        };
    },

    cellLabel: function(row, col) {
        if (col == 0)
            return this.__data[row].fields.name;
        if (col == 1)
            return this.__data[row].fields.created_on.split(" ")[0];
        if (col == 2)
            return this.__data[row].fields.description;
    },

    sortByColumn: function(col) {
        var s = this.__col2sort[col];
        if (this.__sortby == s)
            this.__desc = !this.__desc;
        else
            this.__sortby = s;
        this.refreshData();
    },

    refreshData: function(params) {
        var self = this;

        $.ajax({
            url: "/projects/open",
            data: self.params(),
            dataType: "json",
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



