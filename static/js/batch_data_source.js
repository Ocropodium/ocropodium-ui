// Data source for file browser widget


function BatchDataSource() {
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
}

BatchDataSource.prototype = new AbstractDataSource();
BatchDataSource.constructor = BatchDataSource();

BatchDataSource.prototype.isPaginated = function() {
    return this.__data.has_other_pages;
}

BatchDataSource.prototype.page = function() {
    return this.__page;
}

BatchDataSource.prototype.setPage  = function(page) {
    this.__page = page;
    this.refreshData();
}

BatchDataSource.prototype.nextPage = function() {
    return this.__data.next_page_number;
}

BatchDataSource.prototype.prevPage = function() {
    return this.__data.previous_page_number;
}

BatchDataSource.prototype.hasPrev = function() {
    return this.__data.has_previous;
}

BatchDataSource.prototype.hasNext = function() {
    return this.__data.has_next;
}

BatchDataSource.prototype.numPages = function() {
    return this.__data.num_pages;
}

BatchDataSource.prototype.url = function() {
    return this.__url;
}

BatchDataSource.prototype.dataLength = function() {
    return this.__data.object_list.length;
}

BatchDataSource.prototype.rowMetadata = function(row) {
    return {
        pk: this.__data.object_list[row].pk,
    };
}

BatchDataSource.prototype.rowClassNames = function(row) {
    if (this.__data.object_list[row].fields.is_complete) 
        return [ "complete" ];
    return [];
}

BatchDataSource.prototype.cellClassNames = function(row, col) {
    return [];
}

BatchDataSource.prototype.cellLabel = function(row, col) {
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
}


BatchDataSource.prototype.sortByColumn = function(col) {
    var s = this.__col2sort[col];
    if (this.__sortby == s)
        this.__desc = !this.__desc;
    else
        this.__sortby = s;
    this.refreshData();
}

BatchDataSource.prototype.preSort = function(a, b) {
    return 0;
}

BatchDataSource.prototype.c2d = function(col) {
    return col;
}

BatchDataSource.prototype.refreshData = function(params) {
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
}


