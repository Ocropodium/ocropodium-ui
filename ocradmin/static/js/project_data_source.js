// Data source for project list widget

var ProjectDataSource = AbstractDataSource.extend({
    init: function() {
        this._super();
        this._data = [];
        this._headers = [{
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

        this._sortby = "created_on";
        this._desc = true;
        this._sortcol = 1;
        this._col2sort = {
            0: "name",
            1: "created_on",
            2: "description",
        }
    },

    params: function() {
        return {
            format: "json",
            order: this._desc 
                ? "-" + this._sortby 
                : this._sortby,
        };
    },

    dataLength: function() {
        return this._data.length;
    },

    rowKey: function(row) {
        return this._data[row].pk;
    },

    rowMetadata: function(row) {
        return {
            pk: this._data[row].pk,
        };
    },

    cellLabel: function(row, col) {
        if (col == 0)
            return this._data[row].fields.name;
        if (col == 1)
            return this._data[row].fields.created_on.split(" ")[0];
        if (col == 2)
            return this._data[row].fields.description;
    },

    sortByColumn: function(col) {
        var s = this._col2sort[col];
        if (this._sortby == s)
            this._desc = !this._desc;
        else
            this._sortby = s;
        this.refreshData();
    },

    refreshData: function(params) {
        var self = this;

        $.ajax({
            url: "/projects/open",
            data: self.params(),
            dataType: "json",
            error: OcrJs.ajaxErrorHandler,
            beforeSend: function(e) {
                self.trigger("startRefresh");
            },
            complete: function(e) {
                self.trigger("endRefresh");
            },
            success: function(data) {
                if (data.error) {
                    alert("Error: " + data.error);
                    return;
                }
                self._data = data;
                self.trigger("dataChanged");
            },
        });        
    },
});



